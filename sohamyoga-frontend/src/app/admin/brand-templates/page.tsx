'use client';
// Real Brand Template Management -- first build. Reusable content-template
// library; applying a template creates a real content_variant draft.

import { useEffect, useState } from 'react';

interface Template {
  id: string; brand_kit_id: string | null; name: string; template_type: string;
  platform: string | null; body_template: string; usage_count: number; created_by: string; updated_at: string;
}

const TYPE_LABELS: Record<string, string> = { social_post: 'Social Post', email: 'Email', ad_copy: 'Ad Copy', sms: 'SMS' };
const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'x_twitter', 'tiktok', 'youtube', 'email', 'sms'];

export default function BrandTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('social_post');
  const [platform, setPlatform] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [error, setError] = useState('');
  const [applyMsg, setApplyMsg] = useState<Record<string, string>>({});

  const load = () => { fetch('/api/admin/brand-templates', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setTemplates(d?.templates ?? [])); };
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/brand-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, templateType, platform: platform || null, bodyTemplate }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to create template.'); return; }
    setShowNew(false); setName(''); setBodyTemplate(''); setPlatform('');
    load();
  }

  async function apply(t: Template) {
    const res = await fetch(`/api/admin/brand-templates/${t.id}/apply`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    setApplyMsg(x => ({ ...x, [t.id]: res.ok ? `Draft created (content_variant ${body.contentVariantId.slice(0, 8)})` : (body.error || 'Failed') }));
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reusable content starting points. Applying a template creates a real draft content variant.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium">+ New Template</button>
      </div>

      {showNew && (
        <form onSubmit={create} className="bg-white border rounded-lg p-4 space-y-3">
          <label className="block text-sm">Name
            <input required className="mt-1 w-full rounded border p-2" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Type
              <select className="mt-1 w-full rounded border p-2" value={templateType} onChange={e => setTemplateType(e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block text-sm">Default platform (optional)
              <select className="mt-1 w-full rounded border p-2" value={platform} onChange={e => setPlatform(e.target.value)}>
                <option value="">— none —</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">Body template
            <textarea required rows={4} className="mt-1 w-full rounded border p-2" value={bodyTemplate} onChange={e => setBodyTemplate(e.target.value)} placeholder="e.g. Find your flow this week at Soham Yoga — book your mat today." />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNew(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
            <button type="submit" className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">Create</button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {templates.map(t => (
          <div key={t.id} className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-800">{t.name}</p>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{TYPE_LABELS[t.template_type]}</span>
                  {t.platform && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{t.platform}</span>}
                  <span className="text-xs text-gray-400">used {t.usage_count}x</span>
                </div>
              </div>
              <button onClick={() => apply(t)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded">Apply → Draft</button>
            </div>
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">{t.body_template}</p>
            {applyMsg[t.id] && <p className="text-xs text-green-600 mt-1">{applyMsg[t.id]}</p>}
          </div>
        ))}
        {!templates.length && <p className="text-sm text-gray-400 text-center py-8">No templates yet.</p>}
      </div>
    </div>
  );
}
