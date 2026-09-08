'use client';
// Post Management — Content Asset Library. Complements the real existing
// social publishing engine (src/domain/social) rather than duplicating it:
// this is a reusable media/content-idea library independent of any one
// scheduled post. "Use in new post" pre-fills a real social_content_draft
// row via the real existing drafting flow.

import { useEffect, useState, useCallback } from 'react';

interface AssetRow { id: string; title: string; asset_type: 'image' | 'video' | 'copy_text'; file_url: string | null; body_text: string | null; tags: string[]; category: string | null; created_at: string }

function NewAssetForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(''); const [assetType, setAssetType] = useState<'image' | 'video' | 'copy_text'>('copy_text');
  const [fileUrl, setFileUrl] = useState(''); const [bodyText, setBodyText] = useState('');
  const [tags, setTags] = useState(''); const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/content-library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, assetType, fileUrl: fileUrl || undefined, bodyText: bodyText || undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean), category: category || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setTitle(''); setFileUrl(''); setBodyText(''); setTags(''); setCategory(''); onCreated(); }
    else setError(body.error ?? 'Failed to create content asset.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Asset</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <div className="flex gap-2">
        {(['copy_text', 'image', 'video'] as const).map(t => (
          <button key={t} type="button" onClick={() => setAssetType(t)} className={`px-3 py-1.5 rounded text-sm ${assetType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t === 'copy_text' ? 'Copy text' : t}</button>
        ))}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-2 py-1.5 text-sm" />
      {assetType === 'copy_text' ? (
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Body text" className="w-full border rounded px-2 py-1.5 text-sm" rows={4} />
      ) : (
        <input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="File URL" className="w-full border rounded px-2 py-1.5 text-sm" />
      )}
      <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags, comma, separated" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !title || (assetType === 'copy_text' ? !bodyText : !fileUrl)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function ContentLibraryAdmin() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const url = search ? `/api/content-library?q=${encodeURIComponent(search)}` : '/api/content-library';
    fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setAssets(d?.assets ?? [])).finally(() => setLoading(false));
  }, [search]);
  useEffect(() => { load(); }, [load]);

  async function handleUseInPost(id: string) {
    const res = await fetch(`/api/content-library/${id}/use-in-post`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Draft created (id: ${body.draftId}) — see Post Drafts.` : (body.error ?? 'Failed to create draft.'));
    setTimeout(() => setMessage(null), 4000);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Content Asset Library</h1><p className="text-sm text-gray-500">Reusable media/content-idea library — browse, tag, search, and feed real drafts into the existing social publishing pipeline.</p></div>
        <NewAssetForm onCreated={load} />
      </div>
      <CampaignGeneratorPanel onGenerated={load} />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or tag…" className="w-full max-w-sm border rounded px-3 py-2 text-sm mb-4" />
      {message && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">{message}</p>}
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {assets.map(a => (
            <div key={a.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{a.title} <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 ml-1">{a.asset_type === 'copy_text' ? 'Copy text' : a.asset_type}</span></p>
                  {a.category && <p className="text-xs text-gray-400">{a.category}</p>}
                  {a.asset_type === 'copy_text' ? <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.body_text}</p> : <p className="text-xs text-gray-400 font-mono mt-1">{a.file_url}</p>}
                </div>
                <button onClick={() => handleUseInPost(a.id)} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">Use in new post</button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {a.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
              </div>
            </div>
          ))}
          {!assets.length && <p className="text-sm text-gray-400">No content assets yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}

// Prompt-to-Campaign: one brief generates multiple channel-adapted copy_text
// assets in one pass, closing a named gap ("one prompt to complete campaign
// content") from the ChatGPT platform-blueprint conversation. Real Ollama
// generation, saved straight into the same content_asset library above.
const CHANNEL_LABEL: Record<string, string> = {
  instagram_caption: 'Instagram Caption', email_subject_body: 'Email', sms_text: 'SMS', blog_snippet: 'Blog Snippet',
};

function CampaignGeneratorPanel({ onGenerated }: { onGenerated: () => void }) {
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<string[]>(Object.keys(CHANNEL_LABEL));
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ channel: string; title: string; bodyText: string }[] | null>(null);
  const [error, setError] = useState('');

  const toggleChannel = (c: string) => setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/content-library/generate-campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, channels }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Generation failed.'); return; }
      setResult(data.assets);
      onGenerated();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4">
      <p className="font-semibold text-gray-900 mb-1">Prompt-to-Campaign Content</p>
      <p className="text-xs text-gray-500 mb-3">One campaign brief generates a channel-adapted piece of copy for each channel below — real Ollama generation, saved directly into this library.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(CHANNEL_LABEL).map(([key, label]) => (
          <button key={key} onClick={() => toggleChannel(key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${channels.includes(key) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 bg-white'}`}>{label}</button>
        ))}
      </div>
      <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={2} placeholder="e.g. 'Announce our new evening Vinyasa class starting next month'"
        className="w-full border rounded px-3 py-2 text-sm mb-2" />
      <button onClick={generate} disabled={generating || !brief.trim() || !channels.length} className="bg-indigo-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
        {generating ? 'Generating…' : `Generate ${channels.length} piece${channels.length === 1 ? '' : 's'}`}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {result && (
        <div className="mt-3 space-y-2">
          {result.map(r => (
            <div key={r.channel} className="bg-white border rounded p-2 text-sm">
              <p className="font-medium text-gray-800 text-xs">{CHANNEL_LABEL[r.channel] ?? r.channel}: {r.title}</p>
              <p className="text-gray-500 text-xs mt-1">{r.bodyText}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
