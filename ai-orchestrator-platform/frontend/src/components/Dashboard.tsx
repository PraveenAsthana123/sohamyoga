import { useEffect, useState } from 'react'
import { api, type ModelTag, type Task } from '../api'
import { computeStats, fastestProvider, fmtMs } from '../stats'

interface ModelStat {
  provider: string
  model: string
  count: number
  avgMs: number
  minMs: number
  maxMs: number
}

// Same shape as stats.ts's computeStats, grouped by (provider, model) instead
// of just provider -- kept local to this component since nothing else needs
// the per-model breakdown, to avoid widening the shared stats module.
function computeModelStats(tasks: Task[]): ModelStat[] {
  const byKey = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.model) continue
    const key = `${t.provider}\x00${t.model}`
    const list = byKey.get(key) ?? []
    list.push(t)
    byKey.set(key, list)
  }
  const out: ModelStat[] = []
  for (const [key, list] of byKey) {
    const [provider, model] = key.split('\x00')
    const real = list.filter((t) => t.status === 'completed' && (t.duration_ms ?? 0) > 0).map((t) => t.duration_ms as number)
    if (!real.length) continue // no real (non-cached, non-failed) timing to report
    out.push({
      provider, model, count: real.length,
      avgMs: real.reduce((a, b) => a + b, 0) / real.length,
      minMs: Math.min(...real), maxMs: Math.max(...real),
    })
  }
  return out.sort((a, b) => a.avgMs - b.avgMs)
}

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [cacheStats, setCacheStats] = useState<{ entries: number; total_hits: number } | null>(null)
  const [modelTags, setModelTags] = useState<Record<string, ModelTag>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const refresh = () => {
    setLoading(true)
    Promise.all([api.allTasks(500), api.cacheStats()])
      .then(([t, c]) => {
        setTasks(t)
        setCacheStats(c)
        setErr('')
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [])

  // Tags (SLM/LLM, modality, real parameter_size/context_length for ollama)
  // for every model actually seen in task history, across all 4 local
  // providers -- fetched once, not on the 15s poll, since this metadata is
  // static per pulled model version.
  useEffect(() => {
    Promise.all(['ollama', 'localai', 'llamacpp', 'lmstudio'].map((p) => api.models(p).catch(() => null)))
      .then((results) => {
        const merged: Record<string, ModelTag> = {}
        for (const r of results) if (r) Object.assign(merged, r.tags)
        setModelTags(merged)
      })
  }, [])

  const stats = computeStats(tasks)
  const fastest = fastestProvider(stats)
  const modelStats = computeModelStats(tasks)
  const fastestModel = modelStats[0] ?? null
  const maxAvg = Math.max(1, ...stats.map((s) => s.avgMs))
  const completedTasks = tasks.filter((t) => t.duration_ms != null)
  const overallAvg = completedTasks.length
    ? completedTasks.reduce((a, t) => a + (t.duration_ms ?? 0), 0) / completedTasks.length
    : 0

  return (
    <div className="dashboard">
      <div className="row-between">
        <h2>Response-time report — all providers</h2>
        <button className="btn-small" onClick={refresh}>{loading ? 'Refreshing…' : '⟳ Refresh'}</button>
      </div>
      {err && <div className="conn-err">{err}</div>}

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Requests (last 500)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmtMs(overallAvg)}</div>
          <div className="stat-label">Avg response time</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{cacheStats?.entries ?? '—'}</div>
          <div className="stat-label">Cached prompts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{cacheStats?.total_hits ?? '—'}</div>
          <div className="stat-label">Cache hits (instant replies)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fastest ? fastest.provider : '—'}</div>
          <div className="stat-label">Fastest platform{fastest ? ` (${fmtMs(fastest.avgMs)} avg)` : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fastestModel ? fastestModel.model : '—'}</div>
          <div className="stat-label">Fastest model{fastestModel ? ` on ${fastestModel.provider} (${fmtMs(fastestModel.avgMs)} avg)` : ''}</div>
        </div>
      </div>

      <h3>Average response time by provider</h3>
      <div className="bar-chart">
        {stats.filter((s) => s.avgMs > 0).map((s) => (
          <div className="bar-row" key={s.provider}>
            <div className="bar-label">{s.provider}{fastest?.provider === s.provider ? ' ⚡' : ''}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(s.avgMs / maxAvg) * 100}%` }} />
            </div>
            <div className="bar-value">{fmtMs(s.avgMs)}</div>
          </div>
        ))}
        {stats.filter((s) => s.avgMs > 0).length === 0 && <p className="empty">No completed (non-cached) requests yet.</p>}
      </div>

      <h3>Per-provider breakdown</h3>
      <table>
        <thead>
          <tr>
            <th>Provider</th><th>Requests</th><th>Completed</th><th>Failed</th>
            <th>Avg</th><th>Min</th><th>Max</th><th>Cache hits</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.provider}>
              <td>{s.provider}{fastest?.provider === s.provider ? ' ⚡ fastest' : ''}</td>
              <td>{s.count}</td>
              <td>{s.completed}</td>
              <td>{s.failed > 0 ? <span className="badge badge-error">{s.failed}</span> : 0}</td>
              <td>{s.completed === s.cacheHits ? '—' : fmtMs(s.avgMs)}</td>
              <td>{s.completed === s.cacheHits ? '—' : fmtMs(s.minMs)}</td>
              <td>{s.completed === s.cacheHits ? '—' : fmtMs(s.maxMs)}</td>
              <td>{s.cacheHits}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Model catalog — tags + measured speed</h3>
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Model</th><th>Platform</th><th>SLM/LLM</th><th>Modality</th>
            <th>Parameters</th><th>Context (tokens)</th><th>Avg response</th><th>Runs</th>
          </tr>
        </thead>
        <tbody>
          {modelStats.map((m) => {
            const tag = modelTags[m.model]
            const slmLlm = tag?.tier === 'small' ? 'SLM' : tag?.tier === 'large' ? 'LLM' : '—'
            return (
              <tr key={`${m.provider}:${m.model}`}>
                <td>{m.model}{fastestModel?.model === m.model && fastestModel?.provider === m.provider ? ' ⚡' : ''}</td>
                <td>{m.provider}</td>
                <td>{slmLlm}</td>
                <td>{tag?.modality ?? '—'}</td>
                <td>{tag?.parameter_size ?? '—'}</td>
                <td>{tag?.context_length ? tag.context_length.toLocaleString() : '—'}</td>
                <td>{fmtMs(m.avgMs)}</td>
                <td>{m.count}</td>
              </tr>
            )
          })}
          {modelStats.length === 0 && (
            <tr><td colSpan={8} className="empty">No completed (non-cached) requests yet.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <p className="dashboard-note">
        Parameters/context are Ollama's own reported metadata where available (not measured by this app);
        "—" for a local provider (LocalAI/llama.cpp/LM Studio) means it has no equivalent introspection
        endpoint. Ollama shares one context window between input and output rather than capping them
        separately, so there is no distinct "output tokens" number to show.
      </p>

      <h3>Recent requests (input → response time)</h3>
      <table>
        <thead>
          <tr>
            <th>When</th><th>Provider</th><th>Model</th><th>Status</th><th>Input</th><th>Response time</th>
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, 50).map((t) => (
            <tr key={t.id} className={`task-row task-${t.status}`}>
              <td>{new Date(t.created_at * 1000).toLocaleString()}</td>
              <td>{t.provider}</td>
              <td>{t.model}</td>
              <td>{t.status}</td>
              <td className="reason-cell" title={t.input ?? ''}>{(t.input ?? '').slice(0, 60)}</td>
              <td>{t.duration_ms == null ? '—' : t.duration_ms === 0 ? '⚡ cached' : fmtMs(t.duration_ms)}</td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={6} className="empty">No requests yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
