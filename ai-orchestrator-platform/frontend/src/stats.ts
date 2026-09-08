import type { Task } from './api'

export interface ProviderStat {
  provider: string
  count: number
  completed: number
  failed: number
  avgMs: number
  minMs: number
  maxMs: number
  cacheHits: number
}

export function fmtMs(ms: number): string {
  if (!isFinite(ms)) return '—'
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

export function computeStats(tasks: Task[]): ProviderStat[] {
  const byProvider = new Map<string, Task[]>()
  for (const t of tasks) {
    const list = byProvider.get(t.provider) ?? []
    list.push(t)
    byProvider.set(t.provider, list)
  }
  const stats: ProviderStat[] = []
  for (const [provider, list] of byProvider) {
    const completed = list.filter((t) => t.status === 'completed')
    const failed = list.filter((t) => t.status === 'failed')
    const durations = completed.map((t) => t.duration_ms ?? 0)
    const real = durations.filter((d) => d > 0) // exclude instant cache hits from the avg/min/max so they don't mask real latency
    stats.push({
      provider,
      count: list.length,
      completed: completed.length,
      failed: failed.length,
      avgMs: real.length ? real.reduce((a, b) => a + b, 0) / real.length : 0,
      minMs: real.length ? Math.min(...real) : 0,
      maxMs: real.length ? Math.max(...real) : 0,
      cacheHits: durations.filter((d) => d === 0).length,
    })
  }
  return stats.sort((a, b) => b.count - a.count)
}

// Fastest = lowest avg among providers with at least one real (non-cached)
// completed call -- a provider with zero real data isn't "fast", it's unmeasured.
export function fastestProvider(stats: ProviderStat[]): ProviderStat | null {
  const withData = stats.filter((s) => s.avgMs > 0)
  if (!withData.length) return null
  return withData.reduce((a, b) => (b.avgMs < a.avgMs ? b : a))
}
