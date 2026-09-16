import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import './MediaStudio.css'

type Asset = { id: string; filename: string; kind: string; duration: number; size: number }
type Job = { id: string; kind: string; status: string; stage: string; error: string | null; artifacts: string[]; created_at: number; cancel_requested: number }
type Transcript = { revision: number; language: string; segments: { start: number; end: number; text: string }[] }

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}/media${url}`, options)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${r.status})`)
  }
  return r.json()
}

export function MediaStudio({ project }: { project: string }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [asset, setAsset] = useState('')
  const [url, setUrl] = useState('')
  const [permission, setPermission] = useState(false)
  const [script, setScript] = useState('')
  const [title, setTitle] = useState('')
  const [aspect, setAspect] = useState('landscape')
  const [selected, setSelected] = useState('')
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const query = `project_key=${encodeURIComponent(project)}`

  const refresh = useCallback(async () => {
    const [a, j, c] = await Promise.all([
      request<Asset[]>(`/assets?${query}`), request<Job[]>(`/jobs?${query}`),
      request<{ worker_ready: boolean }>('/capabilities'),
    ])
    setAssets(a); setJobs(j); setReady(c.worker_ready)
  }, [query])

  useEffect(() => {
    let stopped = false
    const poll = () => { if (!stopped) refresh().catch(e => !stopped && setError(String(e))) }
    poll()
    const timer = setInterval(poll, 5000)
    return () => { stopped = true; clearInterval(timer) }
  }, [refresh])
  useEffect(() => { setAsset(''); setSelected(''); setTranscript(null); setNotice(''); setAssets([]); setJobs([]) }, [project])

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('')
    try { await fn(); await refresh() } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  const enqueue = (kind: string, fields: object) => act(async () => {
    await request('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_key: project, kind, request_key: crypto.randomUUID(), ...fields }) })
    setNotice('Job queued. You can leave this page while it runs.')
  })
  const control = (job: Job, action: string) => act(() => request(`/jobs/${job.id}/${action}?${query}`, { method: 'POST' }))
  async function openTranscript(job: Job) {
    await act(async () => { const t = await request<Transcript>(`/jobs/${job.id}/transcript?${query}`); setSelected(job.id); setTranscript(t) })
  }

  return <div className="media-studio">
    <header><h2>Media Studio</h2><p>Turn recordings into editable transcripts, or scripts into narrated videos.</p>
      <span className={`media-status ${ready ? 'ready' : ''}`}>{ready ? 'Local worker ready' : 'Worker unavailable — queued jobs will wait'}</span>
    </header>
    {error && <div role="alert" className="media-error">{error}</div>}
    {notice && <div role="status" className="media-notice">{notice}</div>}
    <div className="media-workflows">
      <section><h3>Video / audio to text</h3><p>Upload up to 256 MB, maximum 120 minutes. Speech is processed locally.</p>
        <label>Recording<input disabled={busy} type="file" accept="audio/*,video/*" onChange={e => {
          const file = e.target.files?.[0]; if (!file) return
          void act(async () => { const form = new FormData(); form.append('project_key', project); form.append('file', file); const a = await request<{ id: string }>('/assets', { method: 'POST', body: form }); setAsset(a.id) })
          e.target.value = ''
        }} /></label>
        <label>Uploaded media<select value={asset} onChange={e => setAsset(e.target.value)}><option value="">Choose a recording</option>{assets.map(a => <option value={a.id} key={a.id}>{a.filename} · {Math.round(a.duration)}s</option>)}</select></label>
        <button disabled={busy || !asset} onClick={() => void enqueue('transcribe', { asset_id: asset })}>Transcribe recording</button>
      </section>
      <section><h3>YouTube to text</h3><p>Retrieves authorized audio and transcribes it locally. If access fails, upload the original media.</p>
        <label>Video URL<input type="url" value={url} placeholder="https://www.youtube.com/watch?v=…" onChange={e => setUrl(e.target.value)} /></label>
        <label className="media-checkbox"><input type="checkbox" checked={permission} onChange={e => setPermission(e.target.checked)} />I am authorized to retrieve and transcribe this video.</label>
        <button disabled={busy || !permission || !url} onClick={() => void enqueue('youtube_transcribe', { source_url: url, authorized_source: permission })}>Create transcript job</button>
      </section>
      <section><h3>Text to narrated video</h3><p>A local voice reads your script over text cards. Caption timing is estimated. This is a template render, not generative footage.</p>
        <label>Title<input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} /></label>
        <label>Script<textarea value={script} maxLength={6000} rows={5} onChange={e => setScript(e.target.value)} /></label>
        <label>Layout<select value={aspect} onChange={e => setAspect(e.target.value)}><option value="landscape">Landscape 16:9</option><option value="portrait">Portrait 9:16</option></select></label>
        <button disabled={busy || !script.trim()} onClick={() => void enqueue('text_video', { text: script, title, aspect })}>Render video</button>
      </section>
    </div>
    <section className="media-jobs"><h3>Jobs in this project</h3>{!jobs.length && <p>No jobs yet. Start with a recording or script above.</p>}
      {jobs.map(job => <article className="media-job" key={job.id}>
        <div><strong>{job.kind.replaceAll('_', ' ')}</strong> <span className="media-status">{job.status}</span><small>{new Date(job.created_at * 1000).toLocaleString()} · {job.stage.replaceAll('_', ' ')}</small></div>
        {job.error && <p className="media-error">{job.error}</p>}
        <div className="media-actions">
          {['queued', 'running'].includes(job.status) && <button disabled={busy || !!job.cancel_requested} onClick={() => void control(job, 'cancel')}>{job.cancel_requested ? 'Cancelling…' : 'Cancel'}</button>}
          {['failed', 'blocked', 'cancelled'].includes(job.status) && <button disabled={busy} onClick={() => void control(job, 'retry')}>Retry</button>}
          {job.status === 'succeeded' && job.kind !== 'text_video' && <button onClick={() => void openTranscript(job)}>Review transcript</button>}
          {job.status === 'succeeded' && job.artifacts.filter(f => !f.startsWith('transcript.')).map(f => <a key={f} href={`${API_BASE}/media/jobs/${job.id}/artifacts/${f}?${query}`}>{f}</a>)}
          {job.status === 'succeeded' && job.kind !== 'text_video' && ['txt', 'md', 'srt', 'vtt', 'json'].map(fmt => <a key={fmt} href={`${API_BASE}/media/jobs/${job.id}/export/${fmt}?${query}`}>{fmt.toUpperCase()}</a>)}
        </div>
      </article>)}
    </section>
    {transcript && <section className="media-transcript"><h3>Transcript review · revision {transcript.revision}</h3><p>Edit text below. Exports use the latest saved revision. No speech produces an empty transcript.</p>
      {transcript.segments.map((s, i) => <label key={i}><small>{s.start.toFixed(1)}–{s.end.toFixed(1)}s</small><textarea rows={2} value={s.text} onChange={e => setTranscript({ ...transcript, segments: transcript.segments.map((old, index) => index === i ? { ...old, text: e.target.value } : old) })} /></label>)}
      <button disabled={busy} onClick={() => void act(async () => { const r = await request<{ revision: number }>(`/jobs/${selected}/transcript?${query}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: transcript.revision, segments: transcript.segments }) }); setTranscript({ ...transcript, revision: r.revision }); setNotice('Transcript revision saved.') })}>Save revision</button>
    </section>}
  </div>
}
