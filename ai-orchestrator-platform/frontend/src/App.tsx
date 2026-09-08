import { useEffect, useRef, useState } from 'react'
import { api, auth, WS_BASE, type Attachment, type Conversation, type IntegrationTool, type Message, type ModelPerformance, type ModelTag, type Persona, type Project, type ProviderStatus, type Task } from './api'
import { Markdown } from './components/Markdown'
import { FilesView } from './components/FilesView'
import { Dashboard } from './components/Dashboard'
import { Login } from './components/Login'
import { SharedConversation } from './components/SharedConversation'
import { computeStats, fastestProvider, fmtMs, type ProviderStat } from './stats'
import './App.css'

type WsEvent =
  | { type: 'user_message'; content: string }
  | { type: 'routing'; provider: string; model: string; reason: string }
  | { type: 'attachment_notes'; notes: string[] }
  | { type: 'assistant_start'; provider: string; model: string; task_id: number }
  | { type: 'assistant_chunk'; text: string }
  | { type: 'assistant_end'; duration_ms: number; task_id: number }
  | { type: 'error'; provider?: string; error: string; task_id?: number }

const STATUS_LABEL: Record<ProviderStatus['status'], string> = {
  connected: 'Connected',
  down: 'Down',
  no_key: 'Not configured',
  quota_exceeded: 'No quota/credits',
  unreachable: 'Unreachable',
  error: 'Error',
}

function StatusBadge({ status }: { status: ProviderStatus['status'] }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
}

function fmtTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

function fmtDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

function fmtModelTag(tag: ModelTag | undefined): string {
  if (!tag) return 'unknown'
  // SLM = Small Language Model, LLM = Large Language Model -- same small/large
  // tier the backend already computes, just the vocabulary the user asked for.
  const slmLlm = tag.tier === 'small' ? 'SLM' : tag.tier === 'large' ? 'LLM' : ''
  const params = tag.parameter_size ? `${tag.parameter_size} params` : ''
  // Ollama doesn't report a SEPARATE max-output-tokens value -- input and
  // output share one context window, so labeling it "in/out" would fabricate
  // a split that doesn't exist in the model's own metadata.
  const ctx = tag.context_length ? `${tag.context_length.toLocaleString()} tok context` : ''
  const modality = tag.modality === 'text' ? '' : tag.modality
  const parts = [slmLlm, modality, params, ctx].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'unknown'
}

function fmtModelPerformance(performance: ModelPerformance | undefined): string {
  if (!performance) return 'not measured'
  return `avg ${fmtDuration(performance.avg_ms)} · ${performance.calls} run${performance.calls === 1 ? '' : 's'}`
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('pcb-theme') || 'light')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pcb-theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

// Browser SpeechRecognition (webkitSpeechRecognition in Chrome/Edge). HONEST
// LIMITATION: this is the BROWSER's own speech-to-text -- in Chrome that
// means audio is sent to Google's servers for transcription, not processed
// locally by any of the models this app talks to. Firefox has no usable
// implementation as of this build, so the mic button just doesn't render
// there rather than pretending to work and silently failing.
function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
  const recognitionRef = useRef<any>(null)

  const toggle = () => {
    if (!supported) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' ')
      onResult(transcript)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  return { listening, supported, toggle }
}

export default function App() {
  // /share/{token} is a public read-only route -- checked BEFORE the auth
  // gate below, since the whole point of a share link is that someone
  // without the praveenchatbot password can open it.
  const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)/)
  const [authed, setAuthed] = useState<boolean | null>(null) // null = still checking
  useEffect(() => {
    if (shareMatch) return
    auth.status().then((s) => setAuthed(s.authenticated)).catch(() => setAuthed(false))
  }, [])

  if (shareMatch) return <SharedConversation token={shareMatch[1]} />
  if (authed === null) return null
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />
  return <AuthedApp onLogout={() => setAuthed(false)} />
}

function AuthedApp({ onLogout }: { onLogout: () => void }) {
  const [theme, toggleTheme] = useTheme()
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<string>('general')
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [providerStats, setProviderStats] = useState<ProviderStat[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState<string>('')
  // Mirrors streamingText/streamingMeta synchronously for the WS onmessage
  // closure below, which is created once per connection and would otherwise
  // see stale state (assistant_end needs the provider/model assistant_start
  // set moments earlier, and the full accumulated text) -- reading state
  // directly in that closure captures whatever it was at connect time, not
  // later updates. Refs sidestep that without a setState-inside-setState
  // updater (nesting setMessages inside setStreamingText's updater made
  // React's StrictMode double-invoke append the message twice in dev).
  const streamingTextRef = useRef('')
  const streamingMetaRef = useRef<{ provider: string; model: string } | null>(null)
  const [streamingMeta, setStreamingMeta] = useState<{ provider: string; model: string } | null>(null)
  const [waitSeconds, setWaitSeconds] = useState<number>(0)
  const [routingReason, setRoutingReason] = useState<string>('')
  const [attachmentNotes, setAttachmentNotes] = useState<string[]>([])
  const [shareStatus, setShareStatus] = useState<string>('')
  const [input, setInput] = useState('')
  const voice = useVoiceInput((transcript) => setInput((prev) => (prev ? `${prev} ${transcript}` : transcript)))
  const [providerOverride, setProviderOverride] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelTags, setModelTags] = useState<Record<string, ModelTag>>({})
  const [modelPerformance, setModelPerformance] = useState<Record<string, ModelPerformance>>({})
  const [modelOverride, setModelOverride] = useState<string>('')
  const [view, setView] = useState<'chat' | 'tasks' | 'files' | 'dashboard' | 'integrations'>('chat')
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [attachError, setAttachError] = useState<string>('')
  const [integrations, setIntegrations] = useState<IntegrationTool[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [personaOverride, setPersonaOverride] = useState<string>('none')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // Left sidebar's own 3-tab layout, separate from `view` (which switches the
  // MAIN content panel). "Folders" is a shortcut that also flips `view` to
  // 'files' since that's where the real folder browser (FilesView) already
  // lives -- no point rebuilding a second one inside the sidebar itself.
  const [sidebarTab, setSidebarTab] = useState<'folders' | 'history' | 'settings'>('history')
  const [tasks, setTasks] = useState<Task[]>([])
  const [connErr, setConnErr] = useState<string>('')
  const [activeContextPath, setActiveContextPath] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const refreshHealth = () => {
    api
      .providers()
      .then(setProviders)
      .catch((e) => setConnErr(String(e)))
    // Response-time-per-provider for the sidebar badges below -- same stats
    // the Dashboard tab computes, just polled here too so "which one's fast
    // right now" is visible without switching tabs.
    api.allTasks(200).then((t) => setProviderStats(computeStats(t))).catch(() => {})
  }

  useEffect(() => {
    api.projects().then(setProjects).catch((e) => setConnErr(String(e)))
    api.personas().then(setPersonas).catch(() => {})
    refreshHealth()
    const t = setInterval(refreshHealth, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    api.conversations(project).then(setConversations).catch((e) => setConnErr(String(e)))
  }, [project])

  useEffect(() => {
    if (activeConvo == null) {
      setMessages([])
      setActiveContextPath(null)
      return
    }
    api.conversation(activeConvo).then((c) => {
      setMessages(c.messages)
      setActiveContextPath(c.context_path ?? null)
    })
    wsRef.current?.close()
    const ws = new WebSocket(`${WS_BASE}/ws/conversations/${activeConvo}`)
    ws.onmessage = (evt) => {
      const data: WsEvent = JSON.parse(evt.data)
      if (data.type === 'user_message') {
        setAttachmentNotes([])
      } else if (data.type === 'routing') {
        setRoutingReason(`${data.provider} — ${data.reason}`)
      } else if (data.type === 'attachment_notes') {
        setAttachmentNotes(data.notes)
      } else if (data.type === 'assistant_start') {
        streamingTextRef.current = ''
        streamingMetaRef.current = { provider: data.provider, model: data.model }
        setStreamingText('')
        setStreamingMeta({ provider: data.provider, model: data.model })
      } else if (data.type === 'assistant_chunk') {
        streamingTextRef.current += data.text
        setStreamingText(streamingTextRef.current)
      } else if (data.type === 'assistant_end') {
        const newMsg = {
          id: Date.now(),
          conversation_id: activeConvo,
          role: 'assistant' as const,
          content: streamingTextRef.current,
          provider: streamingMetaRef.current?.provider ?? null,
          model: streamingMetaRef.current?.model ?? null,
          created_at: Date.now() / 1000,
          duration_ms: data.duration_ms,
        }
        setMessages((m) => [...m, newMsg])
        streamingTextRef.current = ''
        streamingMetaRef.current = null
        setStreamingText('')
        setStreamingMeta(null)
        refreshHealth()
      } else if (data.type === 'error') {
        setStreamingMeta(null)
        setStreamingText('')
        setMessages((m) => [
          ...m,
          {
            id: Date.now(),
            conversation_id: activeConvo,
            role: 'system',
            content: `Error from ${data.provider ?? 'server'}: ${data.error}`,
            provider: data.provider ?? null,
            model: null,
            created_at: Date.now() / 1000,
            duration_ms: null,
          },
        ])
      }
    }
    ws.onerror = () => setConnErr('WebSocket error — is the backend running on :8100?')
    wsRef.current = ws
    return () => ws.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // Model list is per-provider and only meaningful for the 4 local
  // OpenAI-compatible backends (cloud providers use one fixed configured
  // model) -- Ollama alone has 39 pulled models. Default to browsing Ollama's
  // list even under Auto-route, since the router's short-prompt/code rules
  // silently send most chat messages to lmstudio's single qwen coder model --
  // without this, picking any other model required first knowing to force
  // "Ollama" from the provider dropdown.
  const modelListProvider = ['ollama', 'localai', 'llamacpp', 'lmstudio'].includes(providerOverride)
    ? providerOverride
    : providerOverride === ''
      ? 'ollama'
      : ''
  const modelGroups = (['code', 'text', 'vision', 'embedding', 'safety'] as const)
    .map((modality) => ({
      modality,
      models: availableModels.filter((model) => (modelTags[model]?.modality ?? 'text') === modality),
    }))
    .filter((group) => group.models.length > 0)
  useEffect(() => {
    if (!modelListProvider) {
      setAvailableModels([])
      setModelTags({})
      setModelPerformance({})
      setModelOverride('')
      return
    }
    api.models(modelListProvider)
      .then((r) => {
        setAvailableModels(r.models); setModelTags(r.tags); setModelPerformance(r.performance)
        // Don't blindly clear the pick on every provider change -- the
        // Settings "task scenario" radios set provider+model together in
        // one go, and this effect firing right after (because provider
        // changed) would otherwise immediately wipe the model they picked.
        // Keep it only if it's actually valid for the newly-fetched list.
        setModelOverride((prev) => (prev && r.models.includes(prev) ? prev : ''))
      })
      .catch(() => { setAvailableModels([]); setModelTags({}); setModelPerformance({}) })
  }, [modelListProvider])

  // Live elapsed-time counter while waiting for a reply — so "is it still
  // working?" always has a real, ticking answer instead of a static
  // "typing…" with no sense of how long is normal vs. stuck.
  useEffect(() => {
    if (!streamingMeta) {
      setWaitSeconds(0)
      return
    }
    const start = Date.now()
    setWaitSeconds(0)
    const t = setInterval(() => setWaitSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [streamingMeta])

  useEffect(() => {
    if (view === 'tasks') api.tasks(project).then(setTasks).catch((e) => setConnErr(String(e)))
    if (view === 'integrations') api.integrations().then(setIntegrations).catch((e) => setConnErr(String(e)))
  }, [view, project])

  const uploadFiles = async (files: FileList | File[]) => {
    setAttachError('')
    for (const file of Array.from(files)) {
      try {
        const att = await api.uploadAttachment(file)
        setPendingAttachments((a) => [...a, att])
      } catch (e) {
        setAttachError(`${file.name}: ${String(e)}`)
      }
    }
  }

  const newConversation = async () => {
    const c = await api.createConversation(project)
    setConversations((cs) => [c, ...cs])
    setActiveConvo(c.id)
    setSidebarTab('history')
    setView('chat')
  }

  const shareCurrentConversation = async () => {
    if (!activeConvo) return
    const { share_token } = await api.shareConversation(activeConvo)
    const url = `${window.location.origin}/share/${share_token}`
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Link copied to clipboard')
    } catch {
      setShareStatus(url) // clipboard blocked (e.g. insecure context) -- show the raw URL instead of pretending it copied
    }
    setTimeout(() => setShareStatus(''), 6000)
  }

  const exportConversationMarkdown = () => {
    const convo = conversations.find((c) => c.id === activeConvo)
    const title = convo?.title || `Conversation ${activeConvo}`
    const lines = [`# ${title}`, '']
    for (const m of messages) {
      const who = m.role === 'assistant' ? `Assistant (${m.provider ?? '?'}${m.model ? ` / ${m.model}` : ''})` : m.role === 'user' ? 'User' : 'System'
      lines.push(`## ${who} — ${fmtTimestamp(m.created_at)}`, '', m.content, '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9-_]+/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // "Assign work to a project" (build brief item 2): called from FilesView
  // when the user picks a file/dir from search and assigns it. Switches the
  // sidebar project to match (root keys and project keys are the same
  // string by construction — see backend config.KNOWN_PROJECTS), creates a
  // real conversation carrying that context_path, and jumps to Chat so the
  // very next message is already scoped to it.
  const assignContextToNewConversation = async (projectKey: string, contextPath: string, title: string) => {
    setProject(projectKey)
    const c = await api.createConversation(projectKey, title, contextPath)
    setConversations((cs) => [c, ...cs])
    setActiveConvo(c.id)
    setActiveContextPath(c.context_path ?? null)
    setView('chat')
  }

  const send = () => {
    if ((!input.trim() && pendingAttachments.length === 0) || !activeConvo || !wsRef.current) return
    // Show what was attached right in the user's own bubble -- there's no
    // separate attachment viewer yet, so this is the only place it's visible
    // after sending, and it should match what the backend notes back (see
    // WsEvent 'attachment_notes').
    const attachmentPrefix = pendingAttachments.length
      ? pendingAttachments.map((a) => `📎 ${a.filename}`).join('\n') + '\n\n'
      : ''
    setMessages((m) => [
      ...m,
      { id: Date.now(), conversation_id: activeConvo, role: 'user', content: attachmentPrefix + input, provider: null, model: null, created_at: Date.now() / 1000, duration_ms: null },
    ])
    // Picking a specific model implies which provider must serve it -- if the
    // user is on Auto-route (providerOverride === '') but picked a model from
    // the browsed list, honor that exact pick instead of letting the router's
    // content heuristics silently reroute it to a different provider/model.
    const effectiveProvider = providerOverride || (modelOverride ? modelListProvider : '')
    wsRef.current.send(JSON.stringify({
      content: input,
      provider_override: effectiveProvider || undefined,
      model: modelOverride || undefined,
      attachment_ids: pendingAttachments.map((a) => a.id),
      persona: personaOverride !== 'none' ? personaOverride : undefined,
    }))
    setPendingAttachments([])
    setInput('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="row-between">
          <h1>praveenchatbot</h1>
          <div className="row-buttons">
            {/* Fixed position, top-right -- deliberately NOT inline in the
                conversations list below, since a new item there shifts every
                existing entry down and can cause a misclick right when you
                meant to start a fresh chat. */}
            <button className="btn-small" onClick={newConversation} title="New chat">+ New</button>
            <button className="btn-small" onClick={toggleTheme} title="Toggle light/dark">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button className="btn-small" onClick={() => auth.logout().then(onLogout)} title="Log out">⏻</button>
          </div>
        </div>
        <p className="subtitle">Ollama · LocalAI · llama.cpp · LM Studio · OpenAI · Claude</p>

        <div className="sidebar-tabs">
          <button
            className={`btn-tab ${sidebarTab === 'folders' ? 'active' : ''}`}
            onClick={() => { setSidebarTab('folders'); setView('files') }}
          >📁 Folders</button>
          <button className={`btn-tab ${sidebarTab === 'history' ? 'active' : ''}`} onClick={() => setSidebarTab('history')}>💬 History</button>
          <button className={`btn-tab ${sidebarTab === 'settings' ? 'active' : ''}`} onClick={() => setSidebarTab('settings')}>⚙ Settings</button>
        </div>

        {sidebarTab === 'folders' && (
          <div className="section grow">
            <p className="sidebar-hint">Folder browsing, search, and the doc/PDF/code viewer are in the main panel — this tab just jumps you there.</p>
            <button onClick={() => setView('files')}>Open Files</button>
          </div>
        )}

        {sidebarTab === 'settings' && (
          <>
            <div className="section">
              <label>Project</label>
              <select value={project} onChange={(e) => { setProject(e.target.value); setActiveConvo(null) }}>
                {projects.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="section">
              <label>Task scenario</label>
              <div className="scenario-radios">
                {(() => {
                  const ollama = providers.find((p) => p.provider === 'ollama')
                  const lmstudio = providers.find((p) => p.provider === 'lmstudio')
                  const SCENARIOS: { key: string; label: string; provider: string; model: string | null | undefined }[] = [
                    { key: 'auto', label: 'Auto-route (by content)', provider: '', model: '' },
                    { key: 'text', label: 'Text — general chat', provider: 'ollama', model: ollama?.default_model },
                    { key: 'table', label: 'Table / structured data', provider: 'ollama', model: ollama?.table_model },
                    { key: 'multimodal', label: 'Multimodal / vision (images)', provider: 'ollama', model: ollama?.vision_model },
                    { key: 'code', label: 'Code', provider: 'lmstudio', model: lmstudio?.default_model },
                  ]
                  const current = providerOverride === '' && modelOverride === '' ? 'auto'
                    : SCENARIOS.find((s) => s.provider === providerOverride && s.model === modelOverride)?.key ?? ''
                  return SCENARIOS.map((s) => (
                    <label key={s.key} className="radio-row">
                      <input
                        type="radio"
                        name="task-scenario"
                        checked={current === s.key}
                        onChange={() => { setProviderOverride(s.provider); setModelOverride(s.model ?? '') }}
                      />
                      {s.label}
                      {s.key !== 'auto' && s.model && <span className="provider-model"> — {s.model}</span>}
                    </label>
                  ))
                })()}
              </div>
              <p className="sidebar-hint">Picks the provider + model for your next message in Chat. Switch back to Auto-route any time.</p>
            </div>

            <div className="section grow">
              <label>Providers</label>
              <div className="provider-list">
                {(() => {
                  const fastest = fastestProvider(providerStats)
                  return providers.map((p) => {
                    const stat = providerStats.find((s) => s.provider === p.provider)
                    return (
                      <div key={p.provider} className="provider-row" title={p.detail}>
                        <span className="provider-name">
                          {p.provider}
                          {p.provider === 'ollama' && p.large_model ? (
                            <span className="provider-model">small: {p.default_model} · large: {p.large_model}</span>
                          ) : (
                            <span className="provider-model">{p.default_model}</span>
                          )}
                          {stat && stat.avgMs > 0 && (
                            <span className="provider-latency">
                              ~{fmtMs(stat.avgMs)} avg{fastest?.provider === p.provider ? ' ⚡ fastest' : ''}
                            </span>
                          )}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </>
        )}

        {sidebarTab === 'history' && (
          <div className="section grow">
            <label>Conversations</label>
            <div className="convo-list">
              {conversations.map((c) => (
                <div key={c.id} className={`convo-item ${activeConvo === c.id ? 'active' : ''}`} onClick={() => { setActiveConvo(c.id); setView('chat') }}>
                  {c.title || `Conversation #${c.id}`}
                </div>
              ))}
              {conversations.length === 0 && <p className="empty">No conversations yet — click + New above.</p>}
            </div>
          </div>
        )}

        <div className="section">
          <button className={`btn-tab ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>Chat</button>
          <button className={`btn-tab ${view === 'tasks' ? 'active' : ''}`} onClick={() => setView('tasks')}>Task History</button>
          <button className={`btn-tab ${view === 'files' ? 'active' : ''}`} onClick={() => { setSidebarTab('folders'); setView('files') }}>Files</button>
          <button className={`btn-tab ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={`btn-tab ${view === 'integrations' ? 'active' : ''}`} onClick={() => setView('integrations')}>Integrations</button>
        </div>
      </aside>

      <main className="main">
        {connErr && <div className="conn-err">{connErr}</div>}
        {view === 'files' ? (
          <FilesView onAssign={assignContextToNewConversation} />
        ) : view === 'dashboard' ? (
          <Dashboard />
        ) : view === 'integrations' ? (
          <div className="task-history">
            <h2>Integrations — other local tools</h2>
            <p className="dashboard-note">
              These are separate apps on this machine, not routed through this app's chat/task pipeline.
              Their links only work when you're viewing praveenchatbot from THIS machine (127.0.0.1) --
              opening them from a remote browser through the Cloudflare tunnel will not reach them.
            </p>
            <div className="integration-cards">
              {integrations.map((tool) => (
                <div key={tool.key} className="integration-card">
                  <div className="row-between">
                    <strong>{tool.name}</strong>
                    <span className={`badge ${tool.status === 'up' ? 'badge-connected' : 'badge-down'}`}>
                      {tool.status === 'up' ? 'Reachable' : 'Unreachable'}
                    </span>
                  </div>
                  <p className="sidebar-hint">{tool.url}{tool.detail ? ` — ${tool.detail}` : ''}</p>
                  <a href={tool.url} target="_blank" rel="noreferrer">
                    <button disabled={tool.status !== 'up'}>Open ↗</button>
                  </a>
                </div>
              ))}
              {integrations.length === 0 && <p className="empty">Checking…</p>}
            </div>
          </div>
        ) : view === 'tasks' ? (
          <div className="task-history">
            <h2>Task history — {project}</h2>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Provider</th><th>Model</th><th>Status</th><th>Routing reason</th><th>Duration</th><th>When</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className={`task-row task-${t.status}`}>
                    <td>{t.id}</td>
                    <td>{t.provider}</td>
                    <td>{t.model}</td>
                    <td>{t.status}</td>
                    <td className="reason-cell" title={t.routing_reason ?? ''}>{t.routing_reason}</td>
                    <td>{t.duration_ms ? `${t.duration_ms.toFixed(0)} ms` : '—'}</td>
                    <td>{new Date(t.created_at * 1000).toLocaleString()}</td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={7} className="empty">No tasks yet for this project.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : !activeConvo ? (
          <div className="empty-state">
            <p>Select a conversation, or use + New in the top-right to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="chat-header row-between">
              <div>
                {activeContextPath && <span className="context-pill" title={activeContextPath}>context: {activeContextPath}</span>}
                {routingReason && <span className="routing-pill">routed to {routingReason}</span>}
                {attachmentNotes.map((n, i) => <span key={i} className="attachment-note-pill">📎 {n}</span>)}
              </div>
              <div className="row-buttons">
                {shareStatus && <span className="sidebar-hint">{shareStatus}</span>}
                <button className="btn-small" onClick={exportConversationMarkdown} title="Download this conversation as a .md file">⬇ Export .md</button>
                <button className="btn-small" onClick={shareCurrentConversation} title="Create a public read-only link to this conversation">🔗 Share</button>
              </div>
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg msg-${m.role}`}>
                  <div className="msg-meta">
                    <span>
                      {m.role === 'assistant' ? `${m.provider ?? ''} ${m.model ? `(${m.model})` : ''}` : m.role}
                      {' · '}
                      {fmtTimestamp(m.created_at)}
                      {m.duration_ms != null && <span className="duration-pill"> · {fmtDuration(m.duration_ms)}</span>}
                    </span>
                    <button
                      className="btn-copy"
                      title="Copy text"
                      onClick={() => navigator.clipboard.writeText(m.content)}
                    >
                      ⧉ Copy
                    </button>
                  </div>
                  <div className="msg-body">
                    <Markdown text={m.content} />
                  </div>
                </div>
              ))}
              {streamingMeta && (
                <div className="msg msg-assistant streaming">
                  <div className="msg-meta">
                    {streamingMeta.provider} ({streamingMeta.model}) — waiting… <span className="wait-timer">{waitSeconds}s</span>
                    {waitSeconds > 30 && <span className="wait-warning"> (this backend is known to run 25-30s+ under CPU load)</span>}
                  </div>
                  <div className="msg-body">
                    <Markdown text={streamingText} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {(pendingAttachments.length > 0 || attachError) && (
              <div className="attachment-chips">
                {pendingAttachments.map((a) => (
                  <span key={a.id} className="attachment-chip">
                    {a.is_image ? '🖼' : '📄'} {a.filename}
                    <button
                      className="attachment-chip-remove"
                      title="Remove"
                      onClick={() => setPendingAttachments((ps) => ps.filter((p) => p.id !== a.id))}
                    >×</button>
                  </span>
                ))}
                {attachError && <span className="attachment-error">{attachError}</span>}
              </div>
            )}
            <div className="composer">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
              />
              <button
                type="button"
                className="btn-attach"
                title="Attach a file from your desktop"
                onClick={() => fileInputRef.current?.click()}
              >📎</button>
              {voice.supported && (
                <button
                  type="button"
                  className={`btn-attach ${voice.listening ? 'btn-mic-active' : ''}`}
                  title="Voice input (uses your browser's speech recognition -- in Chrome that means audio goes to Google, not processed locally)"
                  onClick={voice.toggle}
                >{voice.listening ? '🔴' : '🎤'}</button>
              )}
              {personas.length > 0 && (
                <select
                  value={personaOverride}
                  onChange={(e) => setPersonaOverride(e.target.value)}
                  title="Persona: a system-prompt preset, not a multi-step agent"
                  className="persona-select"
                >
                  {personas.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.key === 'none' ? 'No persona' : p.key[0].toUpperCase() + p.key.slice(1)}
                    </option>
                  ))}
                </select>
              )}
              <select value={providerOverride} onChange={(e) => setProviderOverride(e.target.value)}>
                <option value="">Auto-route (by content)</option>
                <option value="ollama">Force: Ollama (2nd fastest when warm)</option>
                <option value="localai">Force: LocalAI</option>
                <option value="llamacpp">Force: llama.cpp</option>
                <option value="lmstudio">Force: LM Studio (fast local)</option>
                <option value="openai">Force: OpenAI</option>
                <option value="claude">Force: Claude</option>
              </select>
              {availableModels.length > 0 && (
                <select value={modelOverride} onChange={(e) => setModelOverride(e.target.value)} className="model-select">
                  <option value="">Default model</option>
                  {modelGroups.map((group) => (
                    <optgroup key={group.modality} label={`${group.modality[0].toUpperCase()}${group.modality.slice(1)} models`}>
                      {group.models.map((m) => (
                        <option key={m} value={m}>{m} — {fmtModelTag(modelTags[m])} — {fmtModelPerformance(modelPerformance[m])}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  // Pasted images/files (e.g. a screenshot copied to the
                  // clipboard) show up as e.clipboardData.files -- pasted
                  // plain text does NOT, so this never interferes with
                  // normal text paste (unlimited length: textarea has no
                  // maxLength, so long pastes just aren't truncated).
                  if (e.clipboardData.files.length > 0) {
                    uploadFiles(e.clipboardData.files)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask something… (Enter to send, Shift+Enter for newline)"
              />
              <button onClick={send}>Send</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
