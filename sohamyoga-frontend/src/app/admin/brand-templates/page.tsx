'use client';

import { useEffect, useState, useCallback } from 'react';

interface Template {
  id: string; brand_kit_id: string | null; name: string; template_type: string;
  platform: string | null; body_template: string; usage_count: number;
  created_by: string; updated_at: string;
}

type Tab = 'overview' | 'all' | 'by-category' | 'create';

const TYPE_LABELS: Record<string, string> = {
  social_post: 'Social Post', email: 'Email', ad_copy: 'Ad Copy', sms: 'SMS',
};
const TYPE_COLORS: Record<string, string> = {
  social_post: 'bg-blue-50 text-blue-600',
  email: 'bg-purple-50 text-purple-600',
  ad_copy: 'bg-amber-50 text-amber-700',
  sms: 'bg-green-50 text-green-700',
};
const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'x_twitter', 'tiktok', 'youtube', 'email', 'sms'];
const TEMPLATE_TYPES = Object.keys(TYPE_LABELS);

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function TemplateCard({ template, onApply, applyMsg }: {
  template: Template; onApply: (t: Template) => void; applyMsg?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold text-gray-800">{template.name}</p>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[template.template_type] ?? 'bg-gray-100 text-gray-500'}`}>
              {TYPE_LABELS[template.template_type] ?? template.template_type}
            </span>
            {template.platform && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{template.platform}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-700">{template.usage_count}</p>
          <p className="text-xs text-gray-400">uses</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 line-clamp-3">{template.body_template}</p>
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-400">by {template.created_by} · {new Date(template.updated_at).toLocaleDateString()}</p>
        <button onClick={() => onApply(template)}
          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
          Apply → Draft
        </button>
      </div>
      {applyMsg && <p className="text-xs text-green-600">{applyMsg}</p>}
    </div>
  );
}

function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('social_post');
  const [platform, setPlatform] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleCreate() {
    setError(''); setSuccess('');
    if (!name.trim() || !bodyTemplate.trim()) { setError('Name and body template are required.'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/brand-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, templateType, platform: platform || null, bodyTemplate }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? 'Failed to create template.'); return; }
    setSuccess(`Template "${name}" created.`);
    setName(''); setBodyTemplate(''); setPlatform('');
    onCreated();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 max-w-2xl">
      <h2 className="font-semibold text-gray-800">Create Brand Template</h2>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Template Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Promo Post"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={templateType} onChange={e => setTemplateType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Platform (optional)</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">— none —</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Body Template *</label>
        <textarea value={bodyTemplate} onChange={e => setBodyTemplate(e.target.value)} rows={5}
          placeholder="e.g. Find your flow this week at {studio_name} — book your mat today. {cta_link}"
          className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}
      <button onClick={handleCreate} disabled={saving}
        className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Template'}
      </button>
    </div>
  );
}

export default function BrandTemplatesPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyMsgs, setApplyMsgs] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/brand-templates', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTemplates(d.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleApply(t: Template) {
    const res = await fetch(`/api/admin/brand-templates/${t.id}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    const body = await res.json().catch(() => ({}));
    setApplyMsgs(m => ({
      ...m,
      [t.id]: res.ok
        ? `Draft created (variant ${String(body.contentVariantId ?? '').slice(0, 8)}…)`
        : (body.error ?? 'Failed to apply template'),
    }));
    if (res.ok) load();
  }

  const categories = [...new Set(templates.map(t => t.template_type))];
  const filteredByCategory = categoryFilter ? templates.filter(t => t.template_type === categoryFilter) : templates;

  const totalUsage = templates.reduce((s, t) => s + t.usage_count, 0);
  const topTemplate = [...templates].sort((a, b) => b.usage_count - a.usage_count)[0];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'all', label: `All Templates (${templates.length})` },
    { key: 'by-category', label: 'By Category' },
    { key: 'create', label: 'Create' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Brand Templates</h1>
            <p className="text-sm text-gray-500 mt-0.5">Reusable content templates — applying creates a real content variant draft</p>
          </div>
          <button onClick={load} className="text-sm text-indigo-600 hover:underline">Refresh</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Templates" value={templates.length} />
          <KpiCard label="Categories" value={categories.length} />
          <KpiCard label="Total Uses" value={totalUsage.toLocaleString()} />
          <KpiCard label="Most Used" value={topTemplate?.name ?? '—'} sub={topTemplate ? `${topTemplate.usage_count} uses` : undefined} />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading && <p className="text-sm text-gray-400">Loading templates…</p>}

        {!loading && tab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">Template Distribution</h2>
              <div className="grid grid-cols-4 gap-3">
                {TEMPLATE_TYPES.map(type => {
                  const count = templates.filter(t => t.template_type === type).length;
                  return (
                    <div key={type} className={`rounded-lg p-4 text-center ${TYPE_COLORS[type] ?? 'bg-gray-50'}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs mt-1">{TYPE_LABELS[type]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {templates.slice(0, 6).map(t => (
                <TemplateCard key={t.id} template={t} onApply={handleApply} applyMsg={applyMsgs[t.id]} />
              ))}
            </div>
            {!templates.length && <p className="text-sm text-gray-400 text-center py-8">No templates yet — create one.</p>}
          </div>
        )}

        {!loading && tab === 'all' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {templates.map(t => (
              <TemplateCard key={t.id} template={t} onApply={handleApply} applyMsg={applyMsgs[t.id]} />
            ))}
            {!templates.length && <p className="text-sm text-gray-400 text-center py-8 col-span-3">No templates yet.</p>}
          </div>
        )}

        {!loading && tab === 'by-category' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCategoryFilter('')}
                className={`px-3 py-1.5 text-sm rounded-lg ${!categoryFilter ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                All ({templates.length})
              </button>
              {TEMPLATE_TYPES.map(type => {
                const count = templates.filter(t => t.template_type === type).length;
                if (!count) return null;
                return (
                  <button key={type} onClick={() => setCategoryFilter(type)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${categoryFilter === type ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                    {TYPE_LABELS[type]} ({count})
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredByCategory.map(t => (
                <TemplateCard key={t.id} template={t} onApply={handleApply} applyMsg={applyMsgs[t.id]} />
              ))}
              {!filteredByCategory.length && <p className="text-sm text-gray-400 text-center py-8 col-span-3">No templates in this category.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'create' && (
          <CreateTemplateForm onCreated={load} />
        )}
      </div>
    </div>
  );
}
