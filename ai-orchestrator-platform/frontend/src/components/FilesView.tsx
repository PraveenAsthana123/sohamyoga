import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { api, type FsEntry, type FsRoot, type FsSearchResult } from '../api'
import { Markdown } from './Markdown'
import { PdfViewer } from './PdfViewer'
import { DocxViewer } from './DocxViewer'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi'])

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.py': 'python', '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript',
  '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.json': 'json',
  '.jsonl': 'json', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'ini', '.ini': 'ini',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell', '.css': 'css', '.scss': 'scss',
  '.html': 'html', '.htm': 'html', '.sql': 'sql', '.xml': 'xml', '.md': 'markdown',
  '.markdown': 'markdown', '.go': 'go', '.rs': 'rust', '.java': 'java', '.c': 'c',
  '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp', '.rb': 'ruby', '.php': 'php', '.tex': 'latex',
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function kindOf(name: string): 'pdf' | 'image' | 'video' | 'docx' | 'text' {
  const ext = extOf(name)
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (VIDEO_EXT.has(ext)) return 'video'
  return 'text'
}

interface Selected {
  root: string
  relPath: string
  name: string
}

export function FilesView({ onAssign }: { onAssign: (projectKey: string, contextPath: string, title: string) => void }) {
  const [roots, setRoots] = useState<FsRoot[]>([])
  const [root, setRoot] = useState<string>('')
  const [browsePath, setBrowsePath] = useState<string>('.')
  const [entries, setEntries] = useState<FsEntry[]>([])
  const [query, setQuery] = useState('')
  const [contentSearch, setContentSearch] = useState(false)
  const [searchResult, setSearchResult] = useState<FsSearchResult | null>(null)
  const [searchErr, setSearchErr] = useState('')
  const [selected, setSelected] = useState<Selected | null>(null)
  const [listErr, setListErr] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    api.fsRoots().then((rs) => {
      setRoots(rs)
      const first = rs.find((r) => r.exists)
      if (first) setRoot(first.key)
    })
  }, [])

  useEffect(() => {
    if (!root) return
    setBrowsePath('.')
    setSearchResult(null)
    setSelected(null)
    setSidebarCollapsed(false) // switching project/root -> show the full tree again to browse it
  }, [root])

  useEffect(() => {
    if (!root) return
    setListErr('')
    api.fsList(root, browsePath).then((r) => setEntries(r.entries)).catch((e) => setListErr(String(e)))
  }, [root, browsePath])

  const runSearch = () => {
    if (!root || !query.trim()) return
    setSearchErr('')
    api.fsSearch(root, query, contentSearch).then(setSearchResult).catch((e) => setSearchErr(String(e)))
  }

  const openFile = (relPath: string, name: string) => {
    setSelected({ root, relPath, name })
    // Opening a file gives the editor the room — auto-collapse the browser
    // panel, same as VS Code narrowing the explorer when you focus an editor.
    setSidebarCollapsed(true)
  }

  const currentRootMeta = roots.find((r) => r.key === root)

  return (
    <div className="files-view">
      <button
        className="files-sidebar-toggle"
        title={sidebarCollapsed ? 'Show file browser' : 'Hide file browser (more room for the editor)'}
        onClick={() => setSidebarCollapsed((c) => !c)}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>
      <div className={`files-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="section">
          <label>Workspace root</label>
          <select value={root} onChange={(e) => setRoot(e.target.value)}>
            {roots.map((r) => (
              <option key={r.key} value={r.key} disabled={!r.exists}>
                {r.name}{!r.exists ? ' (not on this machine)' : ''}
              </option>
            ))}
          </select>
          {currentRootMeta?.root_dir && <div className="root-path" title={currentRootMeta.root_dir}>{currentRootMeta.root_dir}</div>}
          {currentRootMeta && (
            <button
              className="btn-small"
              style={{ marginTop: 6 }}
              onClick={() => onAssign(root, `${root}:.`, `Work on ${currentRootMeta.name}`)}
            >
              Assign whole project to new conversation
            </button>
          )}
        </div>

        <div className="section">
          <label>Search (filename{contentSearch ? ' + content' : ''})</label>
          <div className="search-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="e.g. package.json or a keyword"
            />
            <button onClick={runSearch}>Go</button>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={contentSearch} onChange={(e) => setContentSearch(e.target.checked)} />
            grep file contents (slower, bounded)
          </label>
          {searchErr && <div className="conn-err">{searchErr}</div>}
          {searchResult && (
            <div className="search-results">
              <div className="search-meta">
                {searchResult.files_scanned} files scanned
                {searchResult.truncated && <span className="truncated-pill"> · truncated: {searchResult.truncated_reason}</span>}
              </div>
              {searchResult.name_matches.map((m) => (
                <div key={m.rel_path} className="result-row" onClick={() => openFile(m.rel_path, m.name)}>
                  <span className="result-name">{m.name}</span>
                  <span className="result-path">{m.rel_path}</span>
                </div>
              ))}
              {searchResult.content_matches?.map((m, i) => (
                <div key={`${m.rel_path}:${m.line}:${i}`} className="result-row" onClick={() => openFile(m.rel_path, m.rel_path.split('/').pop() || m.rel_path)}>
                  <span className="result-name">{m.rel_path}:{m.line}</span>
                  <span className="result-path">{m.snippet}</span>
                </div>
              ))}
              {searchResult.name_matches.length === 0 && (!searchResult.content_matches || searchResult.content_matches.length === 0) && (
                <div className="empty">No matches.</div>
              )}
            </div>
          )}
        </div>

        <div className="section grow">
          <div className="row-between">
            <label>Browse</label>
            {browsePath !== '.' && (
              <button className="btn-small" onClick={() => {
                const parts = browsePath.split('/')
                parts.pop()
                setBrowsePath(parts.length ? parts.join('/') : '.')
              }}>
                ↑ Up
              </button>
            )}
          </div>
          <div className="browse-path">{browsePath === '.' ? '/' : `/${browsePath}`}</div>
          {listErr && <div className="conn-err">{listErr}</div>}
          <div className="entry-list">
            {entries.map((e) => (
              <div
                key={e.rel_path}
                className="entry-row"
                onClick={() => (e.is_dir ? setBrowsePath(e.rel_path) : openFile(e.rel_path, e.name))}
              >
                <span className="entry-icon">{e.is_dir ? '📁' : '📄'}</span>
                <span className="entry-name">{e.name}</span>
                {!e.is_dir && e.size != null && <span className="entry-size">{(e.size / 1024).toFixed(1)} KB</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="files-preview">
        {!selected ? (
          <div className="empty-state">
            <p>Search or browse a workspace root, then select a file to view or edit it.</p>
          </div>
        ) : (
          <FilePreview
            key={`${selected.root}:${selected.relPath}`}
            selected={selected}
            onAssign={(title) => onAssign(selected.root, `${selected.root}:${selected.relPath}`, title)}
          />
        )}
      </div>
    </div>
  )
}

function FilePreview({ selected, onAssign }: { selected: Selected; onAssign: (title: string) => void }) {
  const kind = kindOf(selected.name)
  const [mode, setMode] = useState<'preview' | 'edit'>(kind === 'text' && extOf(selected.name) === '.md' ? 'preview' : 'edit')
  const [content, setContent] = useState<string>('')
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (kind !== 'text') {
      setLoaded(true)
      return
    }
    setLoaded(false)
    setLoadErr('')
    setSaveStatus('')
    setDirty(false)
    api
      .fsRead(selected.root, selected.relPath)
      .then((r) => {
        setContent(r.content)
        setLoaded(true)
      })
      .catch((e) => {
        setLoadErr(String(e))
        setLoaded(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.root, selected.relPath])

  const save = async () => {
    setSaving(true)
    setSaveStatus('')
    try {
      const r = await api.fsWrite(selected.root, selected.relPath, content)
      setDirty(false)
      setSaveStatus(
        r.verified
          ? `Saved and verified on disk — ${r.bytes_written} bytes at ${r.written_at}`
          : `Write returned but verification mismatch (${r.bytes_written} bytes) — check the file manually`
      )
    } catch (e) {
      setSaveStatus(`Save failed: ${String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="file-preview">
      <div className="preview-toolbar">
        <span className="preview-title" title={`${selected.root}:${selected.relPath}`}>{selected.name}</span>
        {kind === 'text' && extOf(selected.name) === '.md' && (
          <>
            <button className={`btn-small ${mode === 'preview' ? 'active' : ''}`} onClick={() => setMode('preview')}>Rendered</button>
            <button className={`btn-small ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>Edit</button>
          </>
        )}
        {kind === 'text' && mode === 'edit' && (
          <button onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        )}
        <button className="btn-small" onClick={() => {
          const title = window.prompt('Conversation title', `Work on ${selected.name}`)
          if (title != null) onAssign(title)
        }}>
          Assign to new conversation
        </button>
      </div>
      {saveStatus && <div className="save-status">{saveStatus}</div>}

      <div className="preview-body">
        {kind === 'pdf' && <PdfViewer url={api.fsRawUrl(selected.root, selected.relPath)} />}
        {kind === 'docx' && <DocxViewer url={api.fsRawUrl(selected.root, selected.relPath)} />}
        {kind === 'image' && (
          <div className="image-preview">
            <img src={api.fsRawUrl(selected.root, selected.relPath)} alt={selected.name} />
          </div>
        )}
        {kind === 'video' && (
          <div className="video-preview">
            <video src={api.fsRawUrl(selected.root, selected.relPath)} controls style={{ maxWidth: '100%' }} />
          </div>
        )}
        {kind === 'text' && !loaded && <div className="viewer-loading">Loading…</div>}
        {kind === 'text' && loaded && loadErr && <div className="viewer-error">{loadErr}</div>}
        {kind === 'text' && loaded && !loadErr && mode === 'preview' && (
          <div className="markdown-preview">
            <Markdown text={content} />
          </div>
        )}
        {kind === 'text' && loaded && !loadErr && mode === 'edit' && (
          <Editor
            height="100%"
            theme="vs-dark"
            language={LANGUAGE_BY_EXT[extOf(selected.name)] || 'plaintext'}
            value={content}
            onChange={(v) => {
              setContent(v ?? '')
              setDirty(true)
              setSaveStatus('')
            }}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        )}
      </div>
    </div>
  )
}
