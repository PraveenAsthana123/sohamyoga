'use client';
// Module 15 — Long-Form Video & YouTube Management. Was 0/15: only shared
// YouTube upload-metadata columns on social_platform_variant existed, no
// independent catalog. This is a real video catalog with publish lifecycle,
// real on-site view tracking, and (when linked) the real Postiz YouTube
// publish status — never fabricated YouTube-side analytics.

import { useEffect, useState, useCallback } from 'react';

interface VideoRow {
  id: string; slug: string; title: string; tags: string[]; durationSeconds: number | null;
  thumbnailUrl: string | null; sourceUrl: string; status: string; viewCount: number;
  youtubePostId: string | null; youtubePublishStatus: string | null;
  format: 'long_form' | 'reel'; hashtags: string[];
  script: string | null; hookLines: string[]; scriptStatus: 'none' | 'draft' | 'approved';
  renderStatus: 'none' | 'queued' | 'rendering' | 'complete' | 'failed'; renderError: string | null;
  renderDurationSeconds: number | null; renderedAt: string | null;
}

function ScriptAndRenderPanel({ video, onChanged }: { video: VideoRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, action: string) {
    setBusy(action); setError(null);
    const res = await fetch(`/api/videos/${video.id}/${path}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(body.error ?? `Failed to ${action}.`);
    onChanged();
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-400">Script:</span>
        <span className={`px-1.5 py-0.5 rounded-full ${video.scriptStatus === 'approved' ? 'bg-green-100 text-green-700' : video.scriptStatus === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{video.scriptStatus}</span>
        {video.scriptStatus !== 'approved' && (
          <button onClick={() => call('generate-script', 'generate')} disabled={busy !== null} className="text-indigo-600 hover:underline disabled:opacity-50">
            {busy === 'generate' ? 'Generating…' : video.scriptStatus === 'draft' ? 'Regenerate script' : 'Generate script'}
          </button>
        )}
        {video.scriptStatus === 'draft' && video.script && (
          <button onClick={() => call('approve-script', 'approve')} disabled={busy !== null} className="text-green-600 hover:underline disabled:opacity-50">
            {busy === 'approve' ? 'Approving…' : 'Approve script'}
          </button>
        )}
        <span className="text-gray-300 mx-1">|</span>
        <span className="text-gray-400">Render:</span>
        <span className={`px-1.5 py-0.5 rounded-full ${video.renderStatus === 'complete' ? 'bg-green-100 text-green-700' : video.renderStatus === 'failed' ? 'bg-red-100 text-red-700' : video.renderStatus === 'rendering' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>{video.renderStatus}</span>
        {video.scriptStatus === 'approved' && video.renderStatus !== 'rendering' && (
          <button onClick={() => call('render', 'render')} disabled={busy !== null} className="text-indigo-600 hover:underline disabled:opacity-50">
            {busy === 'render' ? 'Starting…' : video.renderStatus === 'complete' ? 'Re-render' : 'Render'}
          </button>
        )}
        {video.renderDurationSeconds != null && <span className="text-gray-400">{video.renderDurationSeconds.toFixed(1)}s</span>}
      </div>
      {video.renderError && <p className="text-xs text-red-600">Render error: {video.renderError}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {video.script && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer text-gray-400">Script + hooks</summary>
          <p className="mt-1 whitespace-pre-wrap">{video.script}</p>
          <ul className="mt-1 list-disc list-inside">
            {video.hookLines.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function NewVideoForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(''); const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState(''); const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [format, setFormat] = useState<'long_form' | 'reel'>('long_form');
  const [hashtags, setHashtags] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true); setError(null);
    const res = await fetch('/api/videos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, title, sourceUrl, description, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        format, hashtags: hashtags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); setSlug(''); setTitle(''); setSourceUrl(''); setHashtags(''); onCreated(); }
    else setError(body.error ?? 'Failed to create video.');
  }

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">+ New Video</button>;
  return (
    <div className="bg-white border rounded-lg p-4 space-y-2 w-full max-w-lg">
      <div className="flex gap-2">
        <button type="button" onClick={() => setFormat('long_form')} className={`px-3 py-1.5 rounded text-sm ${format === 'long_form' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Long-form</button>
        <button type="button" onClick={() => setFormat('reel')} className={`px-3 py-1.5 rounded text-sm ${format === 'reel' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Reel</button>
      </div>
      <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug" className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="Source URL (YouTube link or hosted .mp4)" className="w-full border rounded px-2 py-1.5 text-sm" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="w-full border rounded px-2 py-1.5 text-sm" rows={3} />
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tags, comma, separated" className="w-full border rounded px-2 py-1.5 text-sm" />
      <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#hashtags, comma, separated" className="w-full border rounded px-2 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button onClick={handleCreate} disabled={busy || !slug || !title || !sourceUrl} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">Create draft</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-gray-500">Cancel</button>
      </div>
    </div>
  );
}

export default function VideosAdmin() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'long_form' | 'reel'>('all');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/videos', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setVideos(d?.videos ?? [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!videos.some(v => v.renderStatus === 'rendering')) return;
    const t = setInterval(() => {
      fetch('/api/videos', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setVideos(d.videos ?? []); });
    }, 5000);
    return () => clearInterval(t);
  }, [videos]);

  async function transition(id: string, action: 'publish' | 'archive') {
    await fetch(`/api/videos/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load();
  }

  const visible = videos.filter(v => filter === 'all' || v.format === filter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Video & Reel Management</h1><p className="text-sm text-gray-500">Real video catalog with publish lifecycle and on-site view tracking — long-form and short-form reels share one catalog.</p></div>
        <NewVideoForm onCreated={load} />
      </div>
      <div className="flex gap-2 mb-4">
        {(['all', 'long_form', 'reel'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-sm ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {f === 'all' ? 'All' : f === 'long_form' ? 'Long-form' : 'Reels'}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-3">
          {visible.map(v => (
            <div key={v.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-800">{v.title} <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 ml-1">{v.format === 'reel' ? 'Reel' : 'Long-form'}</span></p>
                  <p className="text-xs text-gray-400 font-mono">/videos/{v.slug} · {v.viewCount} view{v.viewCount === 1 ? '' : 's'}</p>
                  {v.youtubePostId && (
                    <p className="text-xs text-gray-400 mt-1">YouTube publish status: <span className="font-medium">{v.youtubePublishStatus}</span></p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'published' ? 'bg-green-100 text-green-700' : v.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{v.status}</span>
              </div>
              <div className="flex gap-2 mt-2 items-center flex-wrap">
                {v.status === 'draft' && <button onClick={() => transition(v.id, 'publish')} className="text-xs text-green-600 hover:underline">Publish</button>}
                {v.status !== 'archived' && <button onClick={() => transition(v.id, 'archive')} className="text-xs text-gray-400 hover:underline">Archive</button>}
                {v.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{t}</span>)}
                {v.hashtags.map(h => <span key={h} className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">#{h}</span>)}
              </div>
              <ScriptAndRenderPanel video={v} onChanged={load} />
            </div>
          ))}
          {!visible.length && <p className="text-sm text-gray-400">No videos yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}
