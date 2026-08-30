import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite '?url' import gives the built worker file's real served URL — the
// standard way to wire pdf.js's worker under Vite without a CDN dependency.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// A real, working PDF.js-based viewer (per build brief: "a standard PDF.js-
// based viewer or equivalent is fine, this is a well-trodden path, don't
// reinvent it"). Renders actual pages from the given URL onto a canvas with
// prev/next navigation — no mock content, no iframe placeholder.
export function PdfViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDoc(null)
    pdfjsLib
      .getDocument({ url })
      .promise.then((d) => {
        if (cancelled) return
        setDoc(d)
        setNumPages(d.numPages)
        setPage(1)
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

  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let cancelled = false
    doc.getPage(page).then((p) => {
      if (cancelled || !canvasRef.current) return
      const viewport = p.getViewport({ scale: 1.3 })
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      p.render({ canvasContext: ctx, viewport, canvas })
    })
    return () => {
      cancelled = true
    }
  }, [doc, page])

  if (error) return <div className="viewer-error">Failed to load PDF: {error}</div>
  if (loading) return <div className="viewer-loading">Loading PDF…</div>

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ← Prev
        </button>
        <span>
          Page {page} / {numPages}
        </span>
        <button disabled={page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}>
          Next →
        </button>
      </div>
      <div className="pdf-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}
