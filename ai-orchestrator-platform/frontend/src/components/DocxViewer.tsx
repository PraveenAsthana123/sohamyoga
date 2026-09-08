import { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import DOMPurify from 'dompurify'

// Real .docx rendering via mammoth (docx -> semantic HTML). Not
// pixel-identical to Word, but a faithful, working read view of the actual
// document content — headings, paragraphs, lists, tables, bold/italic all
// convert. No mock content, no "unsupported file type" placeholder.
export function DocxViewer({ url }: { url: string }) {
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setHtml('')
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
      .then((result) => {
        if (cancelled) return
        // mammoth's output is real content from an uploaded/scoped file, not
        // trusted markup — sanitize before rendering (2026-09-08 audit fix).
        setHtml(DOMPurify.sanitize(result.value))
        setWarnings(result.messages.map((m) => m.message))
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <div className="viewer-error">Failed to load .docx: {error}</div>
  if (loading) return <div className="viewer-loading">Loading document…</div>

  return (
    <div className="docx-viewer">
      {warnings.length > 0 && (
        <details className="docx-warnings">
          <summary>{warnings.length} formatting note(s) during conversion</summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="docx-content" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
