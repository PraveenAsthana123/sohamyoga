import { useEffect, useState } from 'react'
import { api, type SharedConversation as SharedConversationData } from '../api'
import { Markdown } from './Markdown'

// Public, read-only view for a /share/{token} link -- rendered BEFORE the
// login gate (see App.tsx), since the whole point is that someone without a
// praveenchatbot password can read it. Never shows provider config, other
// conversations, or a way to send a new message -- that's not what this
// route is for.
export function SharedConversation({ token }: { token: string }) {
  const [data, setData] = useState<SharedConversationData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getShared(token).then(setData).catch((e) => setError(String(e)))
  }, [token])

  if (error) {
    return (
      <div className="shared-view">
        <div className="shared-error">This link isn't valid — the conversation was never shared, or sharing was turned off.</div>
      </div>
    )
  }
  if (!data) return null

  return (
    <div className="shared-view">
      <header className="shared-header">
        <strong>{data.title || 'Shared conversation'}</strong>
        <span className="sidebar-hint">Read-only — shared from praveenchatbot on {new Date(data.created_at * 1000).toLocaleString()}</span>
      </header>
      <div className="messages">
        {data.messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <div className="msg-meta">
              {m.role === 'assistant' ? `${m.provider ?? ''} ${m.model ? `(${m.model})` : ''}` : m.role}
            </div>
            <div className="msg-body">
              <Markdown text={m.content} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
