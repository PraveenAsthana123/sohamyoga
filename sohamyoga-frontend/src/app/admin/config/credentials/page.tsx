'use client';
// /admin/config/credentials — Secure portal credential vault.
// Store username/password for any web portal account you've created.
// Credentials are sent via HTTPS to /api/config/credentials → saved to OpenBao.
// NEVER stored in: browser localStorage, git, .env, database, or logs.

import { useState, useCallback } from 'react';

interface PortalDef {
  key:      string;
  label:    string;
  icon:     string;
  color:    string;
  url:      string;
  category: string;
  fields:   FieldDef[];
  note?:    string;
}

interface FieldDef {
  key:         string;
  label:       string;
  type:        'text' | 'password' | 'email' | 'url';
  placeholder: string;
  required:    boolean;
}

const PORTALS: PortalDef[] = [
  // ── Social media portals ──────────────────────────────────────────────────
  { key: 'facebook_biz',  label: 'Facebook Business',   icon: 'Fb', color: 'bg-blue-100 text-blue-800',    category: 'Social',     url: 'business.facebook.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'instagram_biz', label: 'Instagram Business',  icon: 'Ig', color: 'bg-pink-100 text-pink-700',    category: 'Social',     url: 'business.instagram.com',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: '@handle', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'linkedin_biz',  label: 'LinkedIn',             icon: 'In', color: 'bg-blue-100 text-blue-900',    category: 'Social',     url: 'linkedin.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'x_twitter',     label: 'X (Twitter)',          icon: 'X',  color: 'bg-gray-100 text-gray-800',    category: 'Social',     url: 'x.com',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: '@handle', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'youtube',       label: 'YouTube Studio',       icon: 'YT', color: 'bg-red-100 text-red-700',      category: 'Social',     url: 'studio.youtube.com',
    fields: [{ key: 'email', label: 'Google Account Email', type: 'email', placeholder: 'your@gmail.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'tiktok_biz',    label: 'TikTok Business',      icon: 'Tk', color: 'bg-pink-100 text-pink-800',    category: 'Social',     url: 'ads.tiktok.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'pinterest',     label: 'Pinterest',            icon: 'Pi', color: 'bg-rose-100 text-rose-700',    category: 'Social',     url: 'pinterest.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'reddit',        label: 'Reddit',               icon: 'Re', color: 'bg-orange-100 text-orange-700',category: 'Social',     url: 'reddit.com',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: 'u/username', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'discord',       label: 'Discord',              icon: 'Di', color: 'bg-indigo-100 text-indigo-700',category: 'Social',     url: 'discord.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'telegram',      label: 'Telegram',             icon: 'Tg', color: 'bg-sky-100 text-sky-700',      category: 'Social',     url: 'web.telegram.org',
    fields: [{ key: 'phone', label: 'Phone number', type: 'text', placeholder: '+1 555 000 0000', required: true }, { key: 'note', label: 'Note', type: 'text', placeholder: 'e.g. BotFather channel name', required: false }] },

  // ── Developer portals ─────────────────────────────────────────────────────
  { key: 'fb_developers',  label: 'Facebook Developers', icon: 'F⚙', color: 'bg-blue-100 text-blue-700',  category: 'Developer',  url: 'developers.facebook.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }, { key: 'app_id', label: 'App ID (not secret)', type: 'text', placeholder: '1234567890', required: false }] },
  { key: 'google_cloud',   label: 'Google Cloud Console',icon: 'G⚙', color: 'bg-yellow-100 text-yellow-800',category: 'Developer', url: 'console.cloud.google.com',
    fields: [{ key: 'email', label: 'Google Account', type: 'email', placeholder: 'your@gmail.com', required: true }, { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'my-project-123', required: false }] },
  { key: 'x_developer',   label: 'X Developer Portal',  icon: 'X⚙', color: 'bg-gray-100 text-gray-700',  category: 'Developer',  url: 'developer.twitter.com',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: '@handle', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'linkedin_dev',  label: 'LinkedIn Developers', icon: 'L⚙', color: 'bg-blue-100 text-blue-900',  category: 'Developer',  url: 'linkedin.com/developers',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'tiktok_dev',    label: 'TikTok Developers',   icon: 'T⚙', color: 'bg-pink-100 text-pink-700',  category: 'Developer',  url: 'developers.tiktok.com',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'discord_dev',   label: 'Discord Developers',  icon: 'D⚙', color: 'bg-indigo-100 text-indigo-600',category: 'Developer', url: 'discord.com/developers',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },

  // ── AI / API ──────────────────────────────────────────────────────────────
  { key: 'openai',        label: 'OpenAI (ChatGPT API)', icon: 'AI', color: 'bg-emerald-100 text-emerald-700', category: 'AI',      url: 'platform.openai.com/api-keys',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true }],
    note: 'Used for real 2-way ChatGPT feedback via the official OpenAI API (Chat Completions) — not the chatgpt.com consumer site, which has no supported automation API.' },

  // ── Internal tools ────────────────────────────────────────────────────────
  { key: 'postiz',        label: 'Postiz',               icon: 'Pz', color: 'bg-violet-100 text-violet-700',category: 'Tools',     url: 'localhost:3000',
    fields: [{ key: 'email', label: 'Admin Email', type: 'email', placeholder: 'admin@yourdomain.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'mautic',        label: 'Mautic',               icon: 'Ma', color: 'bg-green-100 text-green-700',  category: 'Tools',     url: 'localhost:8001',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: 'admin', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'matomo',        label: 'Matomo Analytics',     icon: 'Mt', color: 'bg-teal-100 text-teal-700',    category: 'Tools',     url: 'localhost:8888',
    fields: [{ key: 'username', label: 'Username', type: 'text', placeholder: 'admin', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'n8n',           label: 'n8n',                  icon: 'n8', color: 'bg-orange-100 text-orange-700', category: 'Tools',    url: 'localhost:5678',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'admin@yourdomain.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'activepieces',  label: 'Activepieces',         icon: 'Ap', color: 'bg-blue-100 text-blue-600',    category: 'Tools',     url: 'localhost:8181',
    fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'admin@yourdomain.com', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  { key: 'keycloak',      label: 'Keycloak',             icon: 'Kc', color: 'bg-amber-100 text-amber-800',  category: 'Tools',     url: 'localhost:8080',
    fields: [{ key: 'username', label: 'Admin Username', type: 'text', placeholder: 'admin', required: true }, { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true }] },
  // Custom portal — user can add anything
  { key: 'custom',        label: 'Custom / Other',       icon: '+',  color: 'bg-gray-100 text-gray-700',    category: 'Custom',    url: '',
    fields: [
      { key: 'portal_name', label: 'Portal name', type: 'text', placeholder: 'e.g. My CRM', required: true },
      { key: 'url',         label: 'URL',          type: 'url',  placeholder: 'https://app.example.com', required: false },
      { key: 'username',    label: 'Username / Email', type: 'text', placeholder: 'your username', required: true },
      { key: 'password',    label: 'Password',     type: 'password', placeholder: '••••••••', required: true },
      { key: 'note',        label: 'Note (optional)', type: 'text', placeholder: 'e.g. admin account', required: false },
    ],
  },
];

const CATEGORIES = ['All', 'Social', 'Developer', 'AI', 'Tools', 'Custom'];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function CredentialVaultPage() {
  const [category, setCategory]   = useState('All');
  const [search, setSearch]       = useState('');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [values, setValues]       = useState<Record<string, Record<string, string>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [saved, setSaved]         = useState<Set<string>>(new Set());

  const filtered = PORTALS.filter(p =>
    (category === 'All' || p.category === category) &&
    p.label.toLowerCase().includes(search.toLowerCase()),
  );

  const setField = useCallback((portalKey: string, fieldKey: string, val: string) => {
    setValues(v => ({
      ...v,
      [portalKey]: { ...(v[portalKey] ?? {}), [fieldKey]: val },
    }));
  }, []);

  const handleSave = useCallback(async (portal: PortalDef) => {
    const fields = values[portal.key] ?? {};
    const hasRequired = portal.fields.filter(f => f.required).every(f => !!fields[f.key]);
    if (!hasRequired) return;

    setSaveStatus(s => ({ ...s, [portal.key]: 'saving' }));
    try {
      const res = await fetch('/api/config/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal: portal.key, fields }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveStatus(s => ({ ...s, [portal.key]: 'saved' }));
      setSaved(s => new Set(s).add(portal.key));
      // Clear field values from memory after successful save
      setValues(v => { const n = { ...v }; delete n[portal.key]; return n; });
    } catch {
      setSaveStatus(s => ({ ...s, [portal.key]: 'error' }));
    }
  }, [values]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Credential Vault</h1>
        <p className="text-gray-500 text-sm mt-1">
          Save portal accounts you have already created. Credentials go directly to OpenBao — never to git, database, or logs.
        </p>
      </div>

      {/* Security banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex gap-3 text-sm">
        <span className="text-amber-500 text-lg shrink-0">🔒</span>
        <div className="text-amber-800">
          <span className="font-semibold">End-to-end secure: </span>
          Credentials submitted here travel over HTTPS to <code className="bg-amber-100 px-1 rounded">/api/config/credentials</code>, which writes them to OpenBao at <code className="bg-amber-100 px-1 rounded">sohamyoga-portal/portals/&lt;name&gt;</code>. They are immediately cleared from the browser after save. Only your OpenBao instance can decrypt them.
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search portals…"
          className="border border-gray-200 rounded px-3 py-2 text-sm flex-1 min-w-40"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${category === c ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Saved count */}
      {saved.size > 0 && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4">
          {saved.size} credential{saved.size > 1 ? 's' : ''} saved to OpenBao this session.
        </div>
      )}

      {/* Portal list */}
      <div className="space-y-2">
        {filtered.map(portal => {
          const isExpanded  = expanded === portal.key;
          const isSaved     = saved.has(portal.key);
          const status      = saveStatus[portal.key] ?? 'idle';
          const fieldVals   = values[portal.key] ?? {};
          const hasRequired = portal.fields.filter(f => f.required).every(f => !!fieldVals[f.key]);

          return (
            <div key={portal.key} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Row header */}
              <button
                type="button"
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(e => e === portal.key ? null : portal.key)}
              >
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${portal.color}`}>
                  {portal.icon}
                </span>
                <span className="flex-1">
                  <span className="font-medium text-gray-900">{portal.label}</span>
                  {portal.url && <span className="ml-2 text-xs text-gray-400">{portal.url}</span>}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  portal.category === 'Social'    ? 'bg-blue-50 text-blue-600'    :
                  portal.category === 'Developer' ? 'bg-purple-50 text-purple-600' :
                  portal.category === 'Tools'     ? 'bg-teal-50 text-teal-600'    :
                                                   'bg-gray-100 text-gray-500'
                }`}>{portal.category}</span>
                {isSaved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Saved</span>}
                <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Expanded form */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {portal.fields.map(field => (
                      <div key={field.key} className={field.type === 'password' ? 'sm:col-span-2' : ''}>
                        <label className="text-xs font-medium text-gray-600 block mb-1">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          value={fieldVals[field.key] ?? ''}
                          onChange={e => setField(portal.key, field.key, e.target.value)}
                          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                          className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    ))}
                  </div>

                  {portal.note && (
                    <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded p-2">{portal.note}</div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!hasRequired || status === 'saving'}
                      onClick={() => handleSave(portal)}
                      className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
                        hasRequired && status !== 'saving'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {status === 'saving' ? 'Saving to OpenBao…' : 'Save to Vault'}
                    </button>
                    {status === 'saved'  && <span className="text-sm text-green-600">Saved. Cleared from browser.</span>}
                    {status === 'error'  && <span className="text-sm text-red-600">Save failed — is OpenBao running?</span>}
                    {portal.url && !portal.url.startsWith('localhost') && (
                      <a href={`https://${portal.url}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-gray-400 hover:text-blue-600">
                        Open {portal.label} →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom portal tip */}
      {category !== 'Custom' && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Don't see your portal?{' '}
          <button onClick={() => { setCategory('Custom'); setExpanded('custom'); }} className="text-blue-500 hover:underline">
            Add a custom portal →
          </button>
        </p>
      )}
    </div>
  );
}
