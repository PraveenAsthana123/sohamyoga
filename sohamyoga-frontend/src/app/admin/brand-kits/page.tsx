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

interface BrandKitRow {
  id: string; name: string; primaryColor: string; secondaryColor: string; accentColor: string;
  logoUrl: string; darkLogoUrl: string | null; fontPrimary: string; fontSecondary: string | null;
  toneWords: string[]; approvedPhrases: string[]; bannedPhrases: string[]; defaultHashtags: string[];
  isDefault: boolean; updatedBy: string; updatedAt: string; createdAt: string;
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

function BrandKitCard({ kit, onChanged }: { kit: BrandKitRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex gap-1.5">
          {[['primary', kit.primaryColor], ['secondary', kit.secondaryColor], ['accent', kit.accentColor]].map(([k, c]) => (
            <span key={k} title={`${k}: ${c}`} className="w-6 h-6 rounded-full border" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {kit.toneWords.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>)}
      </div>
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
      <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="Logo URL" className="w-full border rounded px-2 py-1.5 text-sm" />
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
        <NewBrandKitForm onCreated={load} />
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {kits.map(k => <BrandKitCard key={k.id} kit={k} onChanged={load} />)}
          {!kits.length && <p className="text-sm text-gray-400">No brand kits yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
