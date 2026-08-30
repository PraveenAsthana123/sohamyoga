export const API_BASE = 'http://127.0.0.1:8100'
export const WS_BASE = 'ws://127.0.0.1:8100'

export interface Project {
  key: string
  name: string
  created_at: number
}

export interface ProviderStatus {
  provider: 'ollama' | 'openai' | 'claude'
  default_model: string
  status: 'connected' | 'down' | 'no_key' | 'quota_exceeded' | 'unreachable' | 'error'
  detail: string
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
  postMessage: (id: number, content: string, providerOverride?: string) =>
    fetch(`${API_BASE}/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, provider_override: providerOverride || null }),
    }).then((r) => j<{ provider: string; model: string; routing_reason: string; output: string; duration_ms: number; task_id: number }>(r)),
  tasks: (project?: string) =>
    fetch(`${API_BASE}/tasks${project ? `?project=${encodeURIComponent(project)}` : ''}`).then((r) => j<Task[]>(r)),

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
