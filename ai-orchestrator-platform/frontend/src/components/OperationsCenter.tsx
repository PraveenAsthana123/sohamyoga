import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../api'
import './MediaStudio.css'

type Handoff = { id: string; title: string; body: string; channel: string; kind: string; status: string; revision: number; tags: string[]; receipt_url?: string }
type Followup = { id: string; contact: string; message: string; channel: string; owner: string; due_at: number; status: string; response_note: string; source_url?: string }
type Overview = { handoffs: Handoff[]; followups: Followup[]; overdue: number; counts: Record<string, number>; media_alerts: { id: string; kind: string; error: string }[] }

async function call<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(`${API_BASE}/operations${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : `Request failed (${r.status})`) }
  return r.json()
}

export function OperationsCenter({ project }: { project: string }) {
  const [data, setData] = useState<Overview | null>(null)
  const [catalog, setCatalog] = useState<{ channels: string[]; editors: string[] }>({ channels: [], editors: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('post')
  const [channel, setChannel] = useState('LinkedIn')
  const [tags, setTags] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [owner, setOwner] = useState('')
  const [source, setSource] = useState('')
  const [due, setDue] = useState('')
  const [inboxChannel, setInboxChannel] = useState('LinkedIn')
  const [receipts, setReceipts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const query = `project_key=${encodeURIComponent(project)}`
  const refresh = useCallback(async () => { setData(await call<Overview>(`/overview?${query}`)) }, [query])
  useEffect(() => {
    void call<typeof catalog>('/catalog').then(setCatalog).catch(e => setError(String(e)))
    void refresh().catch(e => setError(String(e)))
    const timer = setInterval(() => void refresh().catch(e => setError(String(e))), 10000)
    return () => clearInterval(timer)
  }, [refresh])
  async function action(fn: () => Promise<unknown>) {
    setError(''); setBusy(true)
    try { await fn(); await refresh() } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return <div className="media-studio">
    <header><h2>Operations Center</h2><p>Prepare content and editorial handoffs, record customer inquiries, and track follow-ups in this project.</p>
      <p>Manual records and exports are supported here. External posting, inbox sync and vendor editing APIs are not connected in this workspace.</p>
      <span className="media-status">{data?.counts.draft ?? 0} drafts</span><span className="media-status">{data?.counts.approved ?? 0} approved handoffs</span><span className="media-status">{data?.overdue ?? 0} overdue follow-ups</span>
    </header>
    {error && <p role="alert" className="media-error">{error}</p>}
    {!!data?.media_alerts.length && <section><h3>Media job alerts</h3>{data.media_alerts.map(a => <p key={a.id} className="media-error">{a.kind}: {a.error}</p>)}</section>}
    <div className="media-workflows">
      <section><h3>Content / listing / editor handoff</h3>
        <label>Type<select value={kind} onChange={e => setKind(e.target.value)}>{['post', 'listing', 'reel', 'editor', 'lesson'].map(k => <option key={k}>{k}</option>)}</select></label>
        <label>Destination<select value={channel} onChange={e => setChannel(e.target.value)}>{[...catalog.channels, ...catalog.editors].map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Title<input maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label>Content / editing instructions<textarea rows={5} maxLength={20000} value={body} onChange={e => setBody(e.target.value)} /></label>
        <label>Tags, separated by commas<input value={tags} onChange={e => setTags(e.target.value)} /></label>
        <button disabled={busy || !title.trim() || !body.trim()} onClick={() => void action(async () => { await call('/handoffs', { project_key: project, title, body, kind, channel, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }); setTitle(''); setBody(''); setTags('') })}>Save draft</button>
      </section>
      <section><h3>Record a customer follow-up</h3><p>Record an inquiry received elsewhere. Saving a response note does not send a message.</p>
        <label>Channel<select value={inboxChannel} onChange={e => setInboxChannel(e.target.value)}>{catalog.channels.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Contact<input value={contact} maxLength={200} onChange={e => setContact(e.target.value)} /></label>
        <label>Inquiry<textarea rows={3} value={message} maxLength={10000} onChange={e => setMessage(e.target.value)} /></label>
        <label>Original thread URL (optional)<input type="url" value={source} onChange={e => setSource(e.target.value)} /></label>
        <label>Assigned to<input value={owner} onChange={e => setOwner(e.target.value)} /></label>
        <label>Response due (your local time)<input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} /></label>
        <button disabled={busy || !contact || !message || !owner || !due} onClick={() => void action(async () => { await call('/followups', { project_key: project, channel: inboxChannel, contact, message, owner, due_at: new Date(due).getTime() / 1000, source_url: source || null }); setContact(''); setMessage(''); setSource('') })}>Record inquiry</button>
      </section>
    </div>
    <section><h3>Content handoffs</h3>{!data?.handoffs.length && <p>No handoffs yet.</p>}{data?.handoffs.map(h => <article className="media-job" key={h.id}>
      <strong>{h.title}</strong><span className="media-status">{h.channel}</span><span className="media-status">{h.status.replaceAll('_', ' ')}</span><p style={{ whiteSpace: 'pre-wrap' }}>{h.body}</p><small>{h.tags.join(' · ')}</small>
      <div className="media-actions">
        {h.status === 'draft' && <button disabled={busy} onClick={() => void action(() => call(`/handoffs/${h.id}/transition?${query}`, { revision: h.revision, action: 'approve' }))}>Approve handoff</button>}
        {h.status !== 'draft' && <a href={`${API_BASE}/operations/handoffs/${h.id}/package?${query}`}>Download handoff ZIP</a>}
        {h.status === 'approved' && <button disabled={busy} onClick={() => void action(() => call(`/handoffs/${h.id}/transition?${query}`, { revision: h.revision, action: 'reopen' }))}>Reopen</button>}
        {h.receipt_url && <a href={h.receipt_url} rel="noreferrer" target="_blank">Recorded result</a>}
      </div>
      {h.status === 'approved' && <div><label>After completing the work, paste the result URL<input type="url" value={receipts[h.id] ?? ''} onChange={e => setReceipts({ ...receipts, [h.id]: e.target.value })} /></label><button disabled={busy || !receipts[h.id]} onClick={() => void action(() => call(`/handoffs/${h.id}/transition?${query}`, { revision: h.revision, action: 'record_completion', receipt_url: receipts[h.id] }))}>Record manual completion</button></div>}
    </article>)}</section>
    <section><h3>Customer follow-ups</h3>{!data?.followups.length && <p>No inquiries recorded yet.</p>}{data?.followups.map(f => <article className="media-job" key={f.id}>
      <strong>{f.contact} · {f.channel}</strong><span className="media-status">{f.status === 'open' && f.due_at * 1000 < Date.now() ? 'Overdue' : f.status}</span><p>{f.message}</p><small>Owner: {f.owner} · Due {new Date(f.due_at * 1000).toLocaleString()}</small>
      {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer">Open original conversation</a>}
      {f.status === 'open' ? <><label>Response / resolution note<textarea value={notes[f.id] ?? ''} onChange={e => setNotes({ ...notes, [f.id]: e.target.value })} /></label><button disabled={busy || !notes[f.id]?.trim()} onClick={() => void action(() => call(`/followups/${f.id}/resolve?${query}`, { response_note: notes[f.id] }))}>Record resolution</button></> : <p>{f.response_note}</p>}
    </article>)}</section>
  </div>
}
