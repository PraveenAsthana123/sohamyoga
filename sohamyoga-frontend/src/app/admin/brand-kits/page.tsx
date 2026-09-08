'use client';
// Brand Kits admin — studio brand guidelines (colors, fonts, tone, approved/banned
// phrases, default hashtags) that CampaignBrief and content-generation jobs can
// reference. Was a real, validated domain class (src/domain/marketing/BrandKit.ts)
// with zero writers anywhere in the app — this page + the /api/brand-kits routes
// are the first real write path.

import { useEffect, useState, useCallback } from 'react';

const TONE_WORDS = [
  'warm', 'professional', 'inspiring', 'inclusive', 'playful',
  'authoritative', 'mindful', 'energetic', 'calm', 'premium',
] as const;

interface BrandHealthCheck { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface BrandHealth { score: number; trafficLight: 'green' | 'amber' | 'red'; checks: BrandHealthCheck[] }

interface BrandKitRow {
  id: string; name: string; primaryColor: string; secondaryColor: string; accentColor: string;
  logoUrl: string; darkLogoUrl: string | null; fontPrimary: string; fontSecondary: string | null;
  toneWords: string[]; approvedPhrases: string[]; bannedPhrases: string[]; defaultHashtags: string[];
  isDefault: boolean; updatedBy: string; updatedAt: string; createdAt: string; health: BrandHealth;
}

const TRAFFIC_LIGHT_COLOR: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', red: 'bg-red-100 text-red-700',
};
const CHECK_STATUS_COLOR: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-700', warn: 'bg-amber-100 text-amber-700', fail: 'bg-red-100 text-red-700',
};

// Brand Health Score -- a real, deterministic completeness + governance
// rubric (src/domain/branding/BrandHealthScore.ts), not an AI opinion. Every
// point traces to a real field being present/valid (logo set, WCAG contrast,
// fonts, tone words, compliance phrases, hashtags).
function BrandHealthPanel({ health }: { health: BrandHealth }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRAFFIC_LIGHT_COLOR[health.trafficLight]}`}>
        Brand Health: {health.score}/100 {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {health.checks.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
              <div><span className="font-medium">{c.label}</span> <span className="text-gray-500">{c.detail}</span></div>
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full font-medium ${CHECK_STATUS_COLOR[c.status]}`}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipList({
  label, items, color, onAdd, onRemove, placeholder,
}: {
  label: string; items: string[]; color: string;
  onAdd: (value: string) => void; onRemove: (value: string) => void; placeholder: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map(item => (
          <span key={item} className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${color}`}>
            {item}
            <button onClick={() => onRemove(item)} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
        {!items.length && <span className="text-xs text-gray-400">none</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
          className="flex-1 border rounded px-2 py-1 text-xs"
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) { onAdd(value.trim()); setValue(''); } }}
        />
        <button
          onClick={() => { if (value.trim()) { onAdd(value.trim()); setValue(''); } }}
          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
        >Add</button>
      </div>
    </div>
  );
}

interface BrandAsset { id: string; name: string; assetType: string; url: string; notes: string; uploadedBy: string; createdAt: string }
const ASSET_TYPES = ['logo', 'photo', 'banner', 'icon', 'video', 'document', 'other'] as const;

function AssetLibraryPanel({ brandKitId }: { brandKitId: string }) {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', assetType: 'photo', url: '', notes: '' });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true); setError('');
    const body = new FormData(); body.append('file', file);
    const res = await fetch('/api/admin/brand-kits/upload', { method: 'POST', body });
    const b = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(b.error ?? 'Upload failed.'); return; }
    setForm(f => ({ ...f, url: b.url, name: f.name || file.name.replace(/\.[^.]+$/, '') }));
  }

  const load = () => {
    fetch(`/api/admin/brand-kits/${brandKitId}/assets`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setAssets(d?.assets ?? []));
  };
  useEffect(load, [brandKitId]);

  async function add() {
    setError('');
    if (!form.name.trim() || !form.url.trim()) { setError('Name and URL are required.'); return; }
    const res = await fetch(`/api/admin/brand-kits/${brandKitId}/assets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); setError(b.error ?? 'Failed to add asset.'); return; }
    setForm({ name: '', assetType: 'photo', url: '', notes: '' });
    load();
  }
  async function remove(id: string) {
    await fetch(`/api/admin/brand-kits/assets/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="mt-3 pt-3 border-t">
      <p className="text-xs font-medium text-gray-500 mb-1.5">Brand Asset Library ({assets.length})</p>
      <div className="space-y-1">
        {assets.map(a => (
          <div key={a.id} className="rounded border bg-gray-50 text-xs">
            <div className="flex justify-between items-center px-2 py-1">
              <button onClick={() => setExpandedId(id => id === a.id ? null : a.id)} className="text-left flex-1 hover:underline">
                <span className="font-medium">{a.name}</span> <span className="text-gray-400">({a.assetType})</span>
              </button>
              <button onClick={() => remove(a.id)} className="text-red-500 hover:underline ml-2">Remove</button>
            </div>
            {expandedId === a.id && (
              <div className="px-2 pb-2 text-gray-500 space-y-0.5">
                <p><a href={a.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">{a.url}</a></p>
                {a.notes && <p>{a.notes}</p>}
                <p className="text-[10px] text-gray-400">Uploaded by {a.uploadedBy} · {new Date(a.createdAt).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        ))}
        {!assets.length && <p className="text-xs text-gray-400">No assets yet.</p>}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Asset name" className="rounded border px-2 py-1 text-xs flex-1 min-w-[100px]" />
        <select value={form.assetType} onChange={e => setForm(f => ({ ...f, assetType: e.target.value }))} className="rounded border px-2 py-1 text-xs">
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL, or upload a file →" className="rounded border px-2 py-1 text-xs flex-1 min-w-[100px]" />
        <label className="rounded border px-2 py-1 text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
          {uploading ? 'Uploading…' : 'Upload file'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ''; }} />
        </label>
        <button onClick={add} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">Add</button>
      </div>
    </div>
  );
}

function BrandKitCard({ kit, onChanged }: { kit: BrandKitRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function patch(action: string, extra: Record<string, unknown>) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/brand-kits/${kit.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(body.error ?? `Failed to ${action}.`);
    onChanged();
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-800 flex items-center gap-2">
            {kit.name}
            {kit.isDefault && <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">Default</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{kit.fontPrimary}{kit.fontSecondary ? ` / ${kit.fontSecondary}` : ''} · updated by {kit.updatedBy}</p>
        </div>
        <button onClick={() => setShowHistory(true)} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">Version history</button>
        <div className="flex gap-1.5">
          {[['primary', kit.primaryColor], ['secondary', kit.secondaryColor], ['accent', kit.accentColor]].map(([k, c]) => (
            <span key={k} title={`${k}: ${c}`} className="w-6 h-6 rounded-full border" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {kit.toneWords.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>)}
      </div>
      <BrandHealthPanel health={kit.health} />
      {busy && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <div className="mt-3 pt-3 border-t grid md:grid-cols-3 gap-4">
        <ChipList
          label="Approved phrases" items={kit.approvedPhrases} color="bg-green-50 text-green-700"
          placeholder="e.g. Find your flow"
          onAdd={p => patch('addApprovedPhrase', { phrase: p })}
          onRemove={p => patch('removeApprovedPhrase', { phrase: p })}
        />
        <ChipList
          label="Banned phrases" items={kit.bannedPhrases} color="bg-red-50 text-red-700"
          placeholder="e.g. cheap"
          onAdd={p => patch('addBannedPhrase', { phrase: p })}
          onRemove={() => setError('Removing banned phrases is not supported by this API yet.')}
        />
        <ChipList
          label="Default hashtags" items={kit.defaultHashtags} color="bg-blue-50 text-blue-600"
          placeholder="#YourTag"
          onAdd={h => patch('addHashtag', { hashtag: h.startsWith('#') ? h : `#${h}` })}
          onRemove={h => patch('removeHashtag', { hashtag: h })}
        />
      </div>
      <AssetLibraryPanel brandKitId={kit.id} />
      {showHistory && <BrandKitHistoryModal brandKitId={kit.id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

interface HistoryEntry { version: number; changedAction: string; changedBy: string; createdAt: string; snapshot: Record<string, unknown> }

function BrandKitHistoryModal({ brandKitId, onClose }: { brandKitId: string; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/brand-kits/${brandKitId}/history`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setHistory(d?.history ?? []))
      .finally(() => setLoading(false));
  }, [brandKitId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-lg max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Version History</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {loading ? <p className="text-sm text-gray-400">Loading…</p> : history.length === 0 ? (
          <p className="text-sm text-gray-400">No prior versions — this brand kit hasn't been edited yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.version} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>v{h.version} · {h.changedAction}</span>
                  <span>{h.changedBy} · {new Date(h.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">Prior state: {String(h.snapshot.primaryColor ?? '')} / {Array.isArray(h.snapshot.approvedPhrases) ? (h.snapshot.approvedPhrases as string[]).length : 0} approved phrases</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewBrandKitForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState('#0EA5E9');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [logoUrl, setLogoUrl] = useState('');
  const [fontPrimary, setFontPrimary] = useState('Inter');
  const [toneWords, setToneWords] = useState<string[]>(['warm']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadLogo(file: File) {
    setUploading(true); setError(null);
    const body = new FormData(); body.append('file', file);
    const res = await fetch('/api/admin/brand-kits/upload', { method: 'POST', body });
    const b = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) { setError(b.error ?? 'Upload failed.'); return; }
    setLogoUrl(b.url);
  }

  function toggleTone(word: string) {
    setToneWords(prev => prev.includes(word) ? prev.filter(w => w !== word) : prev.length < 5 ? [...prev, word] : prev);
  }

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/brand-kits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, primaryColor, secondaryColor, accentColor, logoUrl, fontPrimary, toneWords }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setName(''); setLogoUrl(''); onCreated(); }
    else setError(body.error ?? 'Failed to create brand kit.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Brand Kit</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Brand kit name" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-gray-500">Primary
          <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-full h-8 border rounded" />
        </label>
        <label className="flex-1 text-xs text-gray-500">Secondary
          <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-full h-8 border rounded" />
        </label>
        <label className="flex-1 text-xs text-gray-500">Accent
          <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="w-full h-8 border rounded" />
        </label>
      </div>
      <div className="flex gap-2">
        <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Logo URL, or upload a file →" className="flex-1 border rounded px-2 py-1.5 text-sm" />
        <label className="border rounded px-3 py-1.5 text-sm text-gray-600 cursor-pointer hover:bg-gray-50 whitespace-nowrap">
          {uploading ? 'Uploading…' : 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }} />
        </label>
      </div>
      <input value={fontPrimary} onChange={e => setFontPrimary(e.target.value)} placeholder="Primary font (e.g. Inter)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <div>
        <p className="text-xs text-gray-500 mb-1">Tone words (1-5)</p>
        <div className="flex flex-wrap gap-1.5">
          {TONE_WORDS.map(w => (
            <button key={w} type="button" onClick={() => toggleTone(w)}
              className={`text-xs px-2 py-1 rounded-full ${toneWords.includes(w) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{w}</button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !name || !logoUrl || !fontPrimary || !toneWords.length} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function BrandKitsAdmin() {
  const [kits, setKits] = useState<BrandKitRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/brand-kits', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setKits(d?.brandKits ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Kits</h1>
          <p className="text-sm text-gray-500">Colors, fonts, tone words, and approved/banned phrasing that keep campaigns and generated content on-brand.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/admin/brand-guide/control-mapping" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Control Mapping</a>
          <a href="/api/admin/brand-guide/export" className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">⬇ Export Brand Guide (PDF)</a>
          <NewBrandKitForm onCreated={load} />
        </div>
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {kits.map(k => <BrandKitCard key={k.id} kit={k} onChanged={load} />)}
          {!kits.length && <p className="text-sm text-gray-400">No brand kits yet — create one above.</p>}
        </div>
      )}
      <ComplianceCheckerPanel />
      <ViolationManagementPanel />
      <CustomerPersonaPanel />
    </div>
  );
}

interface ViolationRow {
  id: string; platform: string; adaptedContent: string; violations: string[];
  checkedAt: string; status: string; briefName: string | null;
}

// Real Violation Management -- compliance_status/compliance_violations were
// written automatically by CampaignAdaptationJob/MarketingAutomationJob but
// nothing ever listed what got flagged across campaigns in one place.
function ViolationManagementPanel() {
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/brand-guide/violations', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setViolations(d?.violations ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function recheck(id: string) {
    setError('');
    const res = await fetch(`/api/admin/brand-guide/violations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adaptedContent: editText }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to re-check.'); return; }
    setEditingId(null); setEditText(''); load();
  }

  async function override(id: string) {
    setError('');
    const res = await fetch(`/api/admin/brand-guide/violations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrideReason }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error || 'Failed to override.'); return; }
    setOverridingId(null); setOverrideReason(''); load();
  }

  return (
    <div className="mt-8 border rounded-lg p-4 bg-white">
      <h2 className="font-semibold text-gray-900 mb-1">Violation Management ({violations.length} flagged)</h2>
      <p className="text-xs text-gray-500 mb-3">AI-generated campaign copy that tripped a banned phrase, across every campaign — fix the copy and re-check, or override with a recorded reason.</p>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {loading ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="space-y-2">
          {violations.map(v => (
            <div key={v.id} className="border rounded-lg p-3 text-sm bg-red-50/40">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-xs text-gray-500">{v.briefName ?? 'Unlinked'} · {v.platform}</p>
                  <p className="text-sm text-gray-800 mt-1">{v.adaptedContent}</p>
                  <p className="text-xs text-red-700 mt-1">Violates: {v.violations.join(', ')}</p>
                </div>
              </div>
              {editingId === v.id ? (
                <div className="mt-2 space-y-1.5">
                  <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3} className="w-full border rounded px-2 py-1 text-xs" />
                  <div className="flex gap-2">
                    <button onClick={() => recheck(v.id)} className="text-xs bg-gray-900 text-white px-2 py-1 rounded">Save &amp; Re-check</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                </div>
              ) : overridingId === v.id ? (
                <div className="mt-2 flex gap-2 items-center">
                  <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Reason for override…" className="flex-1 border rounded px-2 py-1 text-xs" />
                  <button onClick={() => override(v.id)} disabled={!overrideReason.trim()} className="text-xs text-amber-700 hover:underline disabled:opacity-40">Confirm</button>
                  <button onClick={() => setOverridingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-3 mt-2">
                  <button onClick={() => { setEditingId(v.id); setEditText(v.adaptedContent); }} className="text-xs text-indigo-600 hover:underline">Edit &amp; re-check</button>
                  <button onClick={() => setOverridingId(v.id)} className="text-xs text-amber-600 hover:underline">Override</button>
                </div>
              )}
            </div>
          ))}
          {!violations.length && <p className="text-xs text-gray-400">No flagged content right now.</p>}
        </div>
      )}
    </div>
  );
}

// Real enforcement, not just storage -- banned_phrases/approved_phrases used
// to sit in the DB with nothing ever checking content against them. This
// panel and CampaignAdaptationJob's automatic check (src/domain/branding/
// BrandComplianceChecker.ts) are the first two real consumers.
function ComplianceCheckerPanel() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ status: string; violations: string[]; usesApprovedPhrase: boolean } | { error: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/brand-guide/check-compliance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setResult(await res.json());
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-8 border rounded-lg p-4 bg-white">
      <h2 className="font-semibold text-gray-900 mb-1">AI Brand Compliance Checker</h2>
      <p className="text-xs text-gray-500 mb-3">Paste draft copy to check it against the default brand kit&apos;s banned/approved phrases — the same check CampaignAdaptationJob now runs automatically on every AI-adapted variant.</p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Paste campaign copy to check…"
        className="w-full border rounded-lg p-2 text-sm mb-2" />
      <button onClick={check} disabled={checking || !text.trim()} className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
        {checking ? 'Checking…' : 'Check Compliance'}
      </button>
      {result && 'error' in result && <p className="text-sm text-red-600 mt-3">{result.error}</p>}
      {result && 'status' in result && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${result.status === 'flagged' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
          <p className="font-medium">{result.status === 'flagged' ? '⚠ Flagged' : '✓ Pass'}</p>
          {result.violations.length > 0 && <p className="mt-1">Banned phrase(s) found: {result.violations.join(', ')}</p>}
          {result.usesApprovedPhrase && <p className="mt-1 text-xs opacity-75">Uses at least one approved phrase.</p>}
        </div>
      )}
    </div>
  );
}

interface PersonaRow {
  id: string; name: string; ageRange: string | null; goals: string[]; painPoints: string[];
  preferredChannels: string[]; notes: string | null; isDefault: boolean;
}

// Customer Persona is deliberately a SEPARATE entity from the brand kits
// above: brand_kit answers "who WE are" (colors/logo/tone), customer_persona
// answers "who WE'RE TALKING TO" (age range, goals, pain points, channels).
// Closes the previously-untracked distinction -- the only prior persona data
// was a loose TEXT[] tag column on campaign_brief, not a managed entity.
function CustomerPersonaPanel() {
  const [personas, setPersonas] = useState<PersonaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [goals, setGoals] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [channels, setChannels] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/customer-personas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(d => setPersonas(d?.personas ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/customer-personas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, ageRange: ageRange || undefined,
        goals: goals.split(',').map(s => s.trim()).filter(Boolean),
        painPoints: painPoints.split(',').map(s => s.trim()).filter(Boolean),
        preferredChannels: channels.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Failed to create persona.'); return; }
    setName(''); setAgeRange(''); setGoals(''); setPainPoints(''); setChannels('');
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/customer-personas/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mt-8 border rounded-lg p-4 bg-white">
      <h2 className="font-semibold text-gray-900 mb-1">Customer Personas</h2>
      <p className="text-xs text-gray-500 mb-3">
        Who you&apos;re talking to — separate from the brand identity above (which is who <em>you</em> are).
        Used to target campaign briefs by audience rather than a loose tag.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Persona name (e.g. Busy Professional)" className="border rounded px-2 py-1.5 text-sm" />
        <input value={ageRange} onChange={e => setAgeRange(e.target.value)} placeholder="Age range (e.g. 30-45)" className="border rounded px-2 py-1.5 text-sm" />
        <input value={goals} onChange={e => setGoals(e.target.value)} placeholder="Goals, comma separated" className="border rounded px-2 py-1.5 text-sm" />
        <input value={painPoints} onChange={e => setPainPoints(e.target.value)} placeholder="Pain points, comma separated" className="border rounded px-2 py-1.5 text-sm" />
        <input value={channels} onChange={e => setChannels(e.target.value)} placeholder="Preferred channels, comma separated" className="border rounded px-2 py-1.5 text-sm col-span-2" />
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={create} disabled={saving || !name.trim()} className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
        {saving ? 'Saving…' : '+ Add Persona'}
      </button>

      {loading ? <p className="text-xs text-gray-400 mt-3">Loading…</p> : (
        <div className="mt-3 space-y-2">
          {personas.map(p => (
            <div key={p.id} className="border rounded p-2 text-sm flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-800">{p.name} {p.ageRange && <span className="text-xs text-gray-400">({p.ageRange})</span>}</p>
                {p.goals.length > 0 && <p className="text-xs text-gray-500">Goals: {p.goals.join(', ')}</p>}
                {p.painPoints.length > 0 && <p className="text-xs text-gray-500">Pain points: {p.painPoints.join(', ')}</p>}
                {p.preferredChannels.length > 0 && <p className="text-xs text-gray-500">Channels: {p.preferredChannels.join(', ')}</p>}
              </div>
              <button onClick={() => remove(p.id)} className="text-xs text-red-500 hover:underline">Remove</button>
            </div>
          ))}
          {!personas.length && <p className="text-xs text-gray-400">No personas yet — add one above.</p>}
        </div>
      )}
    </div>
  );
}
