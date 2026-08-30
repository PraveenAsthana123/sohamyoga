import { useEffect, useRef, useState } from 'react'
import { api, WS_BASE, type Conversation, type Message, type Project, type ProviderStatus, type Task } from './api'
import { Markdown } from './components/Markdown'
import { FilesView } from './components/FilesView'
import './App.css'

type WsEvent =
  | { type: 'user_message'; content: string }
  | { type: 'routing'; provider: string; model: string; reason: string }
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

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState<string>('general')
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvo, setActiveConvo] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingText, setStreamingText] = useState<string>('')
  const [streamingMeta, setStreamingMeta] = useState<{ provider: string; model: string } | null>(null)
  const [routingReason, setRoutingReason] = useState<string>('')
  const [input, setInput] = useState('')
  const [providerOverride, setProviderOverride] = useState<string>('')
  const [view, setView] = useState<'chat' | 'tasks' | 'files'>('chat')
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
  }

  useEffect(() => {
    api.projects().then(setProjects).catch((e) => setConnErr(String(e)))
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
        // already optimistically rendered; nothing to do
      } else if (data.type === 'routing') {
        setRoutingReason(`${data.provider} — ${data.reason}`)
      } else if (data.type === 'assistant_start') {
        setStreamingText('')
        setStreamingMeta({ provider: data.provider, model: data.model })
      } else if (data.type === 'assistant_chunk') {
        setStreamingText((s) => s + data.text)
      } else if (data.type === 'assistant_end') {
        setStreamingText((finalText) => {
          setMessages((m) => [
            ...m,
            {
              id: Date.now(),
              conversation_id: activeConvo,
              role: 'assistant',
              content: finalText,
              provider: streamingMeta?.provider ?? null,
              model: streamingMeta?.model ?? null,
              created_at: Date.now() / 1000,
            },
          ])
          return ''
        })
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

  useEffect(() => {
    if (view === 'tasks') api.tasks(project).then(setTasks).catch((e) => setConnErr(String(e)))
  }, [view, project])

  const newConversation = async () => {
    const c = await api.createConversation(project)
    setConversations((cs) => [c, ...cs])
    setActiveConvo(c.id)
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
    if (!input.trim() || !activeConvo || !wsRef.current) return
    setMessages((m) => [
      ...m,
      { id: Date.now(), conversation_id: activeConvo, role: 'user', content: input, provider: null, model: null, created_at: Date.now() / 1000 },
    ])
    wsRef.current.send(JSON.stringify({ content: input, provider_override: providerOverride || undefined }))
    setInput('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>AI Orchestrator</h1>
        <p className="subtitle">Ollama first-line · OpenAI plans · Claude reviews</p>

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
          <label>Providers</label>
          <div className="provider-list">
            {providers.map((p) => (
              <div key={p.provider} className="provider-row" title={p.detail}>
                <span className="provider-name">{p.provider}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="section grow">
          <div className="row-between">
            <label>Conversations</label>
            <button onClick={newConversation} className="btn-small">+ New</button>
          </div>
          <div className="convo-list">
            {conversations.map((c) => (
              <div key={c.id} className={`convo-item ${activeConvo === c.id ? 'active' : ''}`} onClick={() => { setActiveConvo(c.id); setView('chat') }}>
                {c.title || `Conversation #${c.id}`}
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <button className={`btn-tab ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>Chat</button>
          <button className={`btn-tab ${view === 'tasks' ? 'active' : ''}`} onClick={() => setView('tasks')}>Task History</button>
          <button className={`btn-tab ${view === 'files' ? 'active' : ''}`} onClick={() => setView('files')}>Files</button>
        </div>
      </aside>

      <main className="main">
        {connErr && <div className="conn-err">{connErr}</div>}
        {view === 'files' ? (
          <FilesView onAssign={assignContextToNewConversation} />
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
            <p>Select or create a conversation to start chatting.</p>
            <button onClick={newConversation}>+ New conversation in "{project}"</button>
          </div>
        ) : (
          <>
            <div className="chat-header">
              {activeContextPath && <span className="context-pill" title={activeContextPath}>context: {activeContextPath}</span>}
              {routingReason && <span className="routing-pill">routed to {routingReason}</span>}
            </div>
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg msg-${m.role}`}>
                  <div className="msg-meta">
                    {m.role === 'assistant' ? `${m.provider ?? ''} ${m.model ? `(${m.model})` : ''}` : m.role}
                  </div>
                  <div className="msg-body">
                    <Markdown text={m.content} />
                  </div>
                </div>
              ))}
              {streamingMeta && (
                <div className="msg msg-assistant streaming">
                  <div className="msg-meta">{streamingMeta.provider} ({streamingMeta.model}) — typing…</div>
                  <div className="msg-body">
                    <Markdown text={streamingText} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="composer">
              <select value={providerOverride} onChange={(e) => setProviderOverride(e.target.value)}>
                <option value="">Auto-route</option>
                <option value="ollama">Force: Ollama</option>
                <option value="openai">Force: OpenAI</option>
                <option value="claude">Force: Claude</option>
              </select>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
