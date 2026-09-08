// Relative, same-origin paths (proxied to the backend by vite.config.ts) --
// NOT hardcoded to 127.0.0.1, so this also works through the Cloudflare
// tunnel, where the browser is on a different machine entirely and has no
// route to this server's own loopback address. Same-origin also means the
// session cookie set by /auth/login rides along on every fetch AND on
// <img>/<video> src loads (fs/raw) AND the WebSocket handshake automatically
// -- no manual header wiring needed, unlike a bearer-token scheme.
export const API_BASE = '/api'
export const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

export const auth = {
  status: () => fetch(`${API_BASE}/auth/status`).then((r) => j<{ authenticated: boolean }>(r)),
  login: (password: string) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  logout: () => fetch(`${API_BASE}/auth/logout`, { method: 'POST' }),
}

export interface SharedConversation {
  title: string
  created_at: number
  messages: Message[]
}

export interface Project {
  key: string
  name: string
  created_at: number
}

export interface ProviderStatus {
  provider: 'ollama' | 'localai' | 'llamacpp' | 'lmstudio' | 'openai' | 'claude'
  default_model: string
  large_model?: string | null // ollama only: the "large query" tier alongside default_model's "small" tier
  table_model?: string | null // ollama only: model for the "Table" task scenario
  vision_model?: string | null // ollama only: model for the "Multimodal" task scenario
  status: 'connected' | 'down' | 'no_key' | 'quota_exceeded' | 'unreachable' | 'error'
  detail: string
}

// For Ollama, this is REAL per-model metadata read from Ollama's own
// /api/show (parameter_size, context_length, capabilities) -- source will be
// "ollama-api-show". For the single-model OpenAI-compatible backends (no
// equivalent introspection endpoint), it falls back to a name-parsed guess
// and source is "name-heuristic" -- always check `source` before treating a
// tag as measured. See backend app/providers.py:model_tags_real.
export interface ModelTag {
  tier: 'small' | 'large' | 'unknown'
  modality: 'text' | 'code' | 'vision' | 'embedding' | 'safety'
  source: 'ollama-api-show' | 'name-heuristic'
  parameter_size: string | null // e.g. "1.2B", "137M" -- Ollama-reported, not measured by us
  context_length: number | null // max context window in tokens (shared input+output, not split separately)
  capabilities: string[] // Ollama's own capability list, e.g. ["completion","tools"] -- empty for non-ollama
}

export interface ModelPerformance {
  calls: number
  avg_ms: number
  min_ms: number
  max_ms: number
}

export interface Attachment {
  id: number
  filename: string
  mime_type: string | null
  size: number
  is_image: number
  is_text: number
  extracted_text: string | null
  extraction_note: string | null
  created_at: number
}

export interface IntegrationTool {
  key: string
  name: string
  url: string
  status: 'up' | 'down'
  detail?: string
  checked_at: number
}

export interface Persona {
  key: string
  prompt: string | null
}

export interface Conversation {
  id: number
  project_key: string
  title: string
  created_at: number
  context_path?: string | null
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  provider: string | null
  model: string | null
  created_at: number
  duration_ms: number | null
}

export interface Task {
  id: number
  conversation_id: number | null
  project_key: string
  provider: string
  model: string | null
  status: 'running' | 'completed' | 'failed'
  input: string | null
  output: string | null
  error: string | null
  routing_reason: string | null
  duration_ms: number | null
  created_at: number
  completed_at: number | null
}

// --- Filesystem workspace (search / docs+PDF viewer / code editor) -------
// Mirrors backend app/fsops.py. Every call is scoped server-side to an
// explicit allow-list of project roots; the frontend never assembles or
// trusts a raw filesystem path — it always passes root+rel_path pairs the
// backend re-validates.

export interface FsRoot {
  key: string
  name: string
  root_dir: string | null
  exists: boolean
}

export interface FsEntry {
  name: string
  rel_path: string
  is_dir: boolean
  size: number | null
  mtime: number
}

export interface FsListResult {
  root: string
  path: string
  entries: FsEntry[]
}

export interface FsNameMatch {
  rel_path: string
  name: string
  size: number
  mtime: number
}

export interface FsContentMatch {
  rel_path: string
  line: number
  snippet: string
}

export interface FsSearchResult {
  root: string
  query: string
  content_search: boolean
  files_scanned: number
  name_matches: FsNameMatch[]
  content_matches: FsContentMatch[] | null
  truncated: boolean
  truncated_reason: string | null
}

export interface FsReadResult {
  root: string
  rel_path: string
  content: string
  encoding: string
  size: number
  mtime: number
}

export interface FsWriteResult {
  root: string
  rel_path: string
  bytes_written: number
  verified: boolean
  mtime: number
  written_at: string
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => fetch(`${API_BASE}/health`).then((r) => j<{ ok: boolean; providers: Record<string, ProviderStatus> }>(r)),
  providers: () => fetch(`${API_BASE}/providers`).then((r) => j<ProviderStatus[]>(r)),
  models: (provider: string) =>
    fetch(`${API_BASE}/models/${encodeURIComponent(provider)}`).then((r) =>
      j<{ provider: string; models: string[]; tags: Record<string, ModelTag>; performance: Record<string, ModelPerformance> }>(r)
    ),
  projects: () => fetch(`${API_BASE}/projects`).then((r) => j<Project[]>(r)),
  conversations: (project?: string) =>
    fetch(`${API_BASE}/conversations${project ? `?project=${encodeURIComponent(project)}` : ''}`).then((r) => j<Conversation[]>(r)),
  createConversation: (project: string, title?: string, contextPath?: string | null) =>
    fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, title, context_path: contextPath ?? null }),
    }).then((r) => j<Conversation>(r)),
  setConversationContext: (id: number, contextPath: string | null) =>
    fetch(`${API_BASE}/conversations/${id}/context`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_path: contextPath }),
    }).then((r) => j<Conversation>(r)),
  conversation: (id: number) => fetch(`${API_BASE}/conversations/${id}`).then((r) => j<Conversation & { messages: Message[] }>(r)),
  shareConversation: (id: number) =>
    fetch(`${API_BASE}/conversations/${id}/share`, { method: 'POST' }).then((r) => j<{ share_token: string }>(r)),
  unshareConversation: (id: number) => fetch(`${API_BASE}/conversations/${id}/unshare`, { method: 'POST' }),
  getShared: (token: string) => fetch(`${API_BASE}/share/${encodeURIComponent(token)}`).then((r) => j<SharedConversation>(r)),
  uploadAttachment: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${API_BASE}/attachments`, { method: 'POST', body: form }).then((r) => j<Attachment>(r))
  },
  attachmentRawUrl: (id: number) => `${API_BASE}/attachments/${id}/raw`,
  integrations: () => fetch(`${API_BASE}/integrations`).then((r) => j<IntegrationTool[]>(r)),
  personas: () => fetch(`${API_BASE}/personas`).then((r) => j<Persona[]>(r)),
  postMessage: (id: number, content: string, providerOverride?: string) =>
    fetch(`${API_BASE}/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, provider_override: providerOverride || null }),
    }).then((r) => j<{ provider: string; model: string; routing_reason: string; output: string; duration_ms: number; task_id: number }>(r)),
  tasks: (project?: string) =>
    fetch(`${API_BASE}/tasks${project ? `?project=${encodeURIComponent(project)}` : ''}`).then((r) => j<Task[]>(r)),
  allTasks: (limit = 500) => fetch(`${API_BASE}/tasks?limit=${limit}`).then((r) => j<Task[]>(r)),
  cacheStats: () => fetch(`${API_BASE}/cache/stats`).then((r) => j<{ entries: number; total_hits: number }>(r)),
  cacheClear: () => fetch(`${API_BASE}/cache/clear`, { method: 'POST' }).then((r) => j<{ entries: number; total_hits: number }>(r)),

  fsRoots: () => fetch(`${API_BASE}/fs/roots`).then((r) => j<FsRoot[]>(r)),
  fsList: (root: string, path = '.') =>
    fetch(`${API_BASE}/fs/list?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then((r) => j<FsListResult>(r)),
  fsSearch: (root: string, q: string, content = false) =>
    fetch(`${API_BASE}/fs/search?root=${encodeURIComponent(root)}&q=${encodeURIComponent(q)}&content=${content}`).then((r) => j<FsSearchResult>(r)),
  fsRead: (root: string, path: string) =>
    fetch(`${API_BASE}/fs/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then((r) => j<FsReadResult>(r)),
  fsRawUrl: (root: string, path: string) =>
    `${API_BASE}/fs/raw?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
  fsWrite: (root: string, path: string, content: string) =>
    fetch(`${API_BASE}/fs/write`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, path, content }),
    }).then((r) => j<FsWriteResult>(r)),
}
