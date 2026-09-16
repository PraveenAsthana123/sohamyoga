'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface TranscriptRecord {
  id: string;
  video_id: string;
  video_title: string | null;
  channel_name: string | null;
  channel_id: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  thumbnail_url: string | null;
  video_url: string;
  language: string;
  transcript_raw: string | null;
  transcript_srt: string | null;
  word_count: number | null;
  status: string;
  error_message: string | null;
  ai_summary: string | null;
  ai_key_topics: string[] | null;
  ai_sentiment: string | null;
  created_at: string;
  updated_at: string;
}

interface SegmentRecord {
  id: string;
  transcript_id: string;
  start_seconds: number;
  duration_seconds: number;
  text: string;
  seq_num: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TABS = ['Fetch Transcript', 'All Transcripts', 'Transcript Viewer', 'AI Analysis', 'Batch Processing'] as const;
type Tab = typeof TABS[number];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'auto', label: 'Auto-detect' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function extractVideoId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
  if (match) return match[1];
  // If it looks like a plain video ID (11 chars alphanumeric)
  if (/^[a-zA-Z0-9_\-]{11}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatSegmentTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'done': return { bg: '#d1fae5', text: '#065f46', label: 'Done' };
    case 'pending': return { bg: '#fef3c7', text: '#92400e', label: 'Pending' };
    case 'fetching': return { bg: '#dbeafe', text: '#1e40af', label: 'Fetching…' };
    case 'error': return { bg: '#fee2e2', text: '#991b1b', label: 'Error' };
    case 'no_transcript': return { bg: '#f3f4f6', text: '#6b7280', label: 'No Transcript' };
    default: return { bg: '#f3f4f6', text: '#374151', label: status };
  }
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1f2937', color: '#fff', padding: '12px 20px',
      borderRadius: 8, fontSize: 14, maxWidth: 380, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {message}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────

function TranscriptModal({
  transcript,
  segments,
  onClose,
}: {
  transcript: TranscriptRecord;
  segments: SegmentRecord[];
  onClose: () => void;
}) {
  const statusInfo = statusStyle(transcript.status);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, maxWidth: 780, width: '100%',
          maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {transcript.video_title ?? transcript.video_id}
            </h3>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              {transcript.channel_name ?? 'Unknown channel'} · {transcript.word_count ?? 0} words
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', padding: 0 }}>✕</button>
        </div>

        {/* AI Summary if available */}
        {transcript.ai_summary && (
          <div style={{ padding: '16px 24px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 6 }}>AI Summary</p>
            <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{transcript.ai_summary}</p>
          </div>
        )}

        {/* Segments or raw text */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {segments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {segments.map((seg) => (
                <div key={seg.id} style={{ display: 'flex', gap: 12, fontSize: 13, lineHeight: 1.5 }}>
                  <span style={{ color: '#6b7280', minWidth: 44, fontFamily: 'monospace', flexShrink: 0 }}>
                    [{formatSegmentTime(seg.start_seconds)}]
                  </span>
                  <span style={{ color: '#111827' }}>{seg.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre style={{ margin: 0, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'inherit' }}>
              {transcript.transcript_raw ?? 'No transcript text available.'}
            </pre>
          )}
        </div>

        {/* Status */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: statusInfo.bg, color: statusInfo.text }}>
            {statusInfo.label}
          </span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>Language: {transcript.language}</span>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Fetch Transcript ────────────────────────────────────────────────

function FetchTab({ onFetched }: { onFetched: () => void }) {
  const [urlInput, setUrlInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TranscriptRecord | null>(null);
  const [previewText, setPreviewText] = useState('');

  async function handleFetch() {
    const videoId = extractVideoId(urlInput);
    if (!videoId) { setError('Please enter a valid YouTube URL or video ID.'); return; }

    setLoading(true);
    setError('');
    setWarning('');
    setResult(null);
    setPreviewText('');

    try {
      setProgress('Fetching metadata…');
      await new Promise((r) => setTimeout(r, 300));

      setProgress('Extracting captions…');
      const res = await fetch('/api/admin/youtube-transcript/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, language }),
      });

      setProgress('Running AI analysis…');
      await new Promise((r) => setTimeout(r, 200));

      const data = await res.json() as {
        transcript?: TranscriptRecord;
        segments?: SegmentRecord[];
        warning?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? 'Fetch failed.');
        if (data.warning) setWarning(data.warning);
        setLoading(false);
        setProgress('');
        return;
      }

      if (data.warning) setWarning(data.warning);
      if (data.transcript) {
        setResult(data.transcript);
        setPreviewText(data.transcript.transcript_raw?.slice(0, 1000) ?? '');
      }

      onFetched();
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>Fetch YouTube Transcript</h3>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          YouTube URL or Video ID
        </label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or video ID"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db',
            fontSize: 14, color: '#111827', boxSizing: 'border-box', outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
          style={{
            padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db',
            fontSize: 14, color: '#111827', background: '#fff', outline: 'none', minWidth: 200,
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleFetch}
        disabled={loading || !urlInput.trim()}
        style={{
          padding: '11px 28px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#9ca3af' : '#dc2626', color: '#fff', fontSize: 14, fontWeight: 600,
        }}
      >
        {loading ? 'Fetching…' : 'Fetch Transcript'}
      </button>

      {progress && (
        <div style={{ marginTop: 16, padding: '10px 16px', background: '#dbeafe', borderRadius: 8, fontSize: 14, color: '#1e40af' }}>
          {progress}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fee2e2', borderRadius: 8, fontSize: 14, color: '#991b1b' }}>
          {error}
        </div>
      )}

      {warning && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef3c7', borderRadius: 8, fontSize: 14, color: '#92400e', border: '1px solid #fcd34d' }}>
          <strong>Warning:</strong> {warning}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ padding: '14px 18px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 16 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#065f46' }}>
              {result.video_title ?? result.video_id}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#047857' }}>
              {result.channel_name ?? 'Unknown channel'} · {result.word_count ?? 0} words · Status: {result.status}
            </p>
          </div>
          {previewText && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Transcript Preview (first 1000 chars)
              </label>
              <textarea
                readOnly
                value={previewText}
                style={{
                  width: '100%', height: 200, padding: '10px 14px', borderRadius: 8,
                  border: '1px solid #d1d5db', fontSize: 13, color: '#374151',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
                  background: '#fafafa', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: All Transcripts ────────────────────────────────────────────────

function AllTranscriptsTab({
  transcripts,
  loading,
  onDelete,
  showToast,
}: {
  transcripts: TranscriptRecord[];
  loading: boolean;
  onDelete: (id: string) => void;
  showToast: (msg: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalSegments, setModalSegments] = useState<SegmentRecord[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const filtered = transcripts.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.video_title ?? '').toLowerCase().includes(q) ||
      (t.channel_name ?? '').toLowerCase().includes(q) ||
      t.video_id.toLowerCase().includes(q)
    );
  });

  async function openModal(t: TranscriptRecord) {
    setSelectedId(t.id);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/youtube-transcript/${t.id}`);
      const data = await res.json() as { segments?: SegmentRecord[] };
      setModalSegments(data.segments ?? []);
    } catch {
      setModalSegments([]);
    } finally {
      setModalLoading(false);
    }
  }

  function handleExport(id: string, format: 'txt' | 'srt' | 'json', title: string | null) {
    const a = document.createElement('a');
    a.href = `/api/admin/youtube-transcript/${id}/export?format=${format}`;
    a.download = `${title ?? id}.${format}`;
    a.click();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transcript?')) return;
    try {
      await fetch(`/api/admin/youtube-transcript/${id}`, { method: 'DELETE' });
      onDelete(id);
      showToast('Transcript deleted.');
    } catch {
      showToast('Failed to delete transcript.');
    }
  }

  const selected = selectedId ? transcripts.find((t) => t.id === selectedId) ?? null : null;

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading transcripts…</div>;
  }

  return (
    <div>
      {selected && (
        <TranscriptModal
          transcript={selected}
          segments={modalLoading ? [] : modalSegments}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
          All Transcripts ({filtered.length})
        </h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or channel…"
          style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db',
            fontSize: 14, color: '#111827', outline: 'none', width: 260,
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: 12 }}>
          No transcripts found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((t) => {
            const statusInfo = statusStyle(t.status);
            return (
              <div
                key={t.id}
                style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                  overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Thumbnail */}
                {t.thumbnail_url ? (
                  <img
                    src={t.thumbnail_url}
                    alt={t.video_title ?? ''}
                    style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block', background: '#f3f4f6' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: 140, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 36 }}>▶</span>
                  </div>
                )}

                {/* Body */}
                <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.4 }}>
                    {t.video_title ?? t.video_id}
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
                    {t.channel_name ?? 'Unknown channel'}
                    {t.word_count ? ` · ${t.word_count.toLocaleString()} words` : ''}
                    {t.published_at ? ` · ${t.published_at}` : ''}
                  </p>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: statusInfo.bg, color: statusInfo.text,
                    }}>
                      {statusInfo.label}
                    </span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#374151' }}>
                      {t.language.toUpperCase()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
                    <button
                      onClick={() => openModal(t)}
                      style={{
                        padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #3b82f6',
                        color: '#3b82f6', background: '#eff6ff', cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      View Full
                    </button>
                    <button
                      onClick={() => handleExport(t.id, 'txt', t.video_title)}
                      style={{
                        padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db',
                        color: '#374151', background: '#fff', cursor: 'pointer',
                      }}
                    >
                      TXT
                    </button>
                    <button
                      onClick={() => handleExport(t.id, 'srt', t.video_title)}
                      style={{
                        padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db',
                        color: '#374151', background: '#fff', cursor: 'pointer',
                      }}
                    >
                      SRT
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{
                        padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5',
                        color: '#dc2626', background: '#fff7f7', cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Transcript Viewer ──────────────────────────────────────────────

function ViewerTab({
  transcripts,
  showToast,
}: {
  transcripts: TranscriptRecord[];
  showToast: (msg: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentRecord[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'srt' | 'json'>('txt');

  const selected = transcripts.find((t) => t.id === selectedId) ?? null;

  async function loadSegments(id: string) {
    setLoadingSegments(true);
    try {
      const res = await fetch(`/api/admin/youtube-transcript/${id}`);
      const data = await res.json() as { segments?: SegmentRecord[] };
      setSegments(data.segments ?? []);
    } catch {
      setSegments([]);
    } finally {
      setLoadingSegments(false);
    }
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    loadSegments(id);
  }

  function handleCopyAll() {
    if (!selected) return;
    const text = selected.transcript_raw ?? segments.map((s) => s.text).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('Transcript copied to clipboard!'));
  }

  function handleExport() {
    if (!selected) return;
    const a = document.createElement('a');
    a.href = `/api/admin/youtube-transcript/${selected.id}/export?format=${exportFormat}`;
    a.click();
  }

  const doneTranscripts = transcripts.filter((t) => t.status === 'done');

  return (
    <div style={{ display: 'flex', gap: 24, height: 620 }}>
      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, overflow: 'auto', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: 8 }}>
        <p style={{ padding: '8px 8px 0', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
          Transcripts
        </p>
        {doneTranscripts.length === 0 ? (
          <p style={{ padding: '16px 8px', fontSize: 13, color: '#9ca3af' }}>No done transcripts.</p>
        ) : (
          doneTranscripts.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                border: 'none', cursor: 'pointer', marginTop: 4,
                background: selectedId === t.id ? '#dbeafe' : 'transparent',
                color: selectedId === t.id ? '#1e40af' : '#374151',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                {t.video_title ?? t.video_id}
              </p>
              {t.duration_seconds && (
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  {formatDuration(t.duration_seconds)}
                </p>
              )}
            </button>
          ))
        )}
      </div>

      {/* Main viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 15 }}>
            Select a transcript from the sidebar
          </div>
        ) : (
          <>
            {/* AI Summary */}
            {selected.ai_summary && (
              <div style={{ padding: '14px 18px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 14 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>AI Summary</p>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1e3a8a', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{selected.ai_summary}</p>
                {selected.ai_key_topics && selected.ai_key_topics.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selected.ai_key_topics.map((topic) => (
                      <span key={topic} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#bfdbfe', color: '#1e40af' }}>
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <button
                onClick={handleCopyAll}
                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                Copy All
              </button>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'txt' | 'srt' | 'json')}
                style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', outline: 'none' }}
              >
                <option value="txt">TXT</option>
                <option value="srt">SRT</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={handleExport}
                style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
              >
                Export
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                {selected.word_count?.toLocaleString() ?? 0} words
              </span>
            </div>

            {/* Segments display */}
            <div style={{ flex: 1, overflow: 'auto', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16 }}>
              {loadingSegments ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Loading…</div>
              ) : segments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {segments.map((seg) => (
                    <div key={seg.id} style={{ display: 'flex', gap: 12, fontSize: 13, lineHeight: 1.5, padding: '3px 0' }}>
                      <span style={{ color: '#9ca3af', fontFamily: 'monospace', minWidth: 48, flexShrink: 0 }}>
                        [{formatSegmentTime(seg.start_seconds)}]
                      </span>
                      <span style={{ color: '#111827' }}>{seg.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre style={{ margin: 0, fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontFamily: 'inherit' }}>
                  {selected.transcript_raw ?? 'No transcript text available.'}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Tab 4: AI Analysis ────────────────────────────────────────────────────

function AIAnalysisTab({
  transcripts,
  showToast,
}: {
  transcripts: TranscriptRecord[];
  showToast: (msg: string) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const [results, setResults] = useState<{ type: string; content: string }[]>([]);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const selected = transcripts.find((t) => t.id === selectedId);

  async function runAnalysis(type: 'summarize' | 'keywords' | 'repurpose') {
    if (!selected?.transcript_raw) return;

    const prompts: Record<string, string> = {
      summarize: `Provide a comprehensive summary of this video transcript in 5 paragraphs: ${selected.transcript_raw}`,
      keywords: `Extract the top 20 keywords and phrases from this transcript with their frequency: ${selected.transcript_raw}`,
      repurpose: `Based on this YouTube transcript, suggest 5 ways to repurpose this content (blog post, social media, email newsletter, podcast script, infographic). Transcript: ${selected.transcript_raw.slice(0, 2000)}`,
    };

    const labels: Record<string, string> = {
      summarize: 'Comprehensive Summary',
      keywords: 'Top Keywords & Phrases',
      repurpose: 'Content Repurpose Ideas',
    };

    setLoadingType(type);
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: prompts[type], stream: false }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) throw new Error('Ollama request failed');
      const data = await res.json() as { response?: string };
      const content = data.response?.trim() ?? 'No response from Ollama.';

      setResults((prev) => [{ type: labels[type], content }, ...prev.filter((r) => r.type !== labels[type])]);
    } catch {
      setResults((prev) => [
        { type: labels[type], content: 'Ollama not available. Ensure Ollama is running at http://localhost:11434 with a model loaded.' },
        ...prev.filter((r) => r.type !== labels[type]),
      ]);
    } finally {
      setLoadingType(null);
    }
  }

  function handleCopyResult(content: string) {
    navigator.clipboard.writeText(content).then(() => showToast('Copied to clipboard!'));
  }

  function handleUseCampaign(content: string) {
    navigator.clipboard.writeText(content).then(() => showToast('Content copied to clipboard — ready to paste into a campaign!'));
  }

  const doneTranscripts = transcripts.filter((t) => t.status === 'done' && t.transcript_raw);

  return (
    <div>
      <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>AI Analysis</h3>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Select Transcript
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db',
              fontSize: 14, color: '#111827', background: '#fff', outline: 'none',
            }}
          >
            <option value="">— select a transcript —</option>
            {doneTranscripts.map((t) => (
              <option key={t.id} value={t.id}>
                {t.video_title ?? t.video_id} ({t.word_count ?? 0} words)
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedId && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[
            { type: 'summarize' as const, label: 'Summarize', color: '#7c3aed' },
            { type: 'keywords' as const, label: 'Extract Keywords', color: '#0891b2' },
            { type: 'repurpose' as const, label: 'Content Repurpose Ideas', color: '#b45309' },
          ].map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => runAnalysis(type)}
              disabled={loadingType !== null}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none', cursor: loadingType ? 'not-allowed' : 'pointer',
                background: loadingType === type ? '#9ca3af' : color, color: '#fff',
                fontSize: 13, fontWeight: 600,
              }}
            >
              {loadingType === type ? 'Analyzing…' : label}
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && selectedId && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: 12, fontSize: 14 }}>
          Select an analysis action above to get AI insights.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {results.map((result) => (
          <div
            key={result.type}
            style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div style={{ padding: '14px 18px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{result.type}</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleCopyResult(result.content)}
                  style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}
                >
                  Copy
                </button>
                <button
                  onClick={() => handleUseCampaign(result.content)}
                  style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Use in Campaign
                </button>
              </div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                {result.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab 5: Batch Processing ───────────────────────────────────────────────

interface BatchResult {
  url: string;
  videoId: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  title?: string;
  wordCount?: number;
  message?: string;
  transcript?: TranscriptRecord;
}

function BatchTab({ onFetched }: { onFetched: () => void }) {
  const [urlsText, setUrlsText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [progress, setProgress] = useState(0);

  const urls = urlsText
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 10);

  async function handleFetchAll() {
    if (!urls.length) return;
    setProcessing(true);
    setProgress(0);

    const initialResults: BatchResult[] = urls.map((url) => ({
      url,
      videoId: extractVideoId(url),
      status: 'pending',
    }));
    setResults(initialResults);

    for (let i = 0; i < initialResults.length; i++) {
      const item = initialResults[i];
      setProgress(i);

      try {
        const res = await fetch('/api/admin/youtube-transcript/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: item.videoId, language: 'en' }),
        });
        const data = await res.json() as {
          transcript?: TranscriptRecord;
          warning?: string;
          error?: string;
        };

        let newStatus: BatchResult['status'] = 'success';
        let message = '';

        if (!res.ok || data.error) {
          newStatus = 'error';
          message = data.error ?? 'Fetch failed';
        } else if (data.warning) {
          newStatus = 'warning';
          message = data.warning;
        }

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: newStatus,
                  title: data.transcript?.video_title ?? item.videoId,
                  wordCount: data.transcript?.word_count ?? undefined,
                  message,
                  transcript: data.transcript,
                }
              : r
          )
        );
      } catch (err) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', message: err instanceof Error ? err.message : 'Network error' }
              : r
          )
        );
      }

      setProgress(i + 1);
    }

    setProcessing(false);
    onFetched();
  }

  function handleDownloadAll() {
    const successItems = results.filter((r) => r.status === 'success' && r.transcript?.transcript_raw);
    if (!successItems.length) return;

    const combined = successItems
      .map((r) => {
        const title = r.transcript?.video_title ?? r.videoId;
        return `=== ${title} ===\nVideo ID: ${r.videoId}\nWords: ${r.wordCount ?? 0}\n\n${r.transcript?.transcript_raw ?? ''}\n\n`;
      })
      .join('\n' + '='.repeat(60) + '\n\n');

    const blob = new Blob([combined], { type: 'text/plain; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcripts_batch_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  const resultStyle = (status: BatchResult['status']) => {
    switch (status) {
      case 'success': return { bg: '#d1fae5', text: '#065f46', label: 'Success' };
      case 'warning': return { bg: '#fef3c7', text: '#92400e', label: 'Warning' };
      case 'error': return { bg: '#fee2e2', text: '#991b1b', label: 'Error' };
      default: return { bg: '#f3f4f6', text: '#6b7280', label: 'Pending' };
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>Batch Processing</h3>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          YouTube URLs (one per line, up to 10)
        </label>
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={'https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\nvideo_id_here'}
          disabled={processing}
          style={{
            width: '100%', height: 160, padding: '10px 14px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
            boxSizing: 'border-box', outline: 'none',
          }}
        />
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>
          {urls.length} / 10 URLs entered
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={handleFetchAll}
          disabled={processing || urls.length === 0}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: processing ? '#9ca3af' : '#dc2626', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer',
          }}
        >
          {processing ? `Fetching ${progress}/${urls.length}…` : 'Fetch All'}
        </button>
        {results.some((r) => r.status === 'success') && !processing && (
          <button
            onClick={handleDownloadAll}
            style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Download All as TXT
          </button>
        )}
      </div>

      {/* Progress bar */}
      {processing && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', background: '#dc2626', borderRadius: 6,
                width: `${urls.length > 0 ? (progress / urls.length) * 100 : 0}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>
            {progress} of {urls.length} processed
          </p>
        </div>
      )}

      {/* Summary row */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>
            {successCount} Success
          </span>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
            {warningCount} Warning
          </span>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
            {errorCount} Error
          </span>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>URL</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Title</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Words</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const info = resultStyle(r.status);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 200 }}>
                      <span title={r.url} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.videoId}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#111827', maxWidth: 220 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#374151' }}>{r.wordCount ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: info.bg, color: info.text }}>
                        {info.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', maxWidth: 280 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.message}>
                        {r.message ?? '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function YouTubeTranscriptPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Fetch Transcript');
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => setToast(msg), []);

  async function loadTranscripts() {
    setLoadingTranscripts(true);
    try {
      const res = await fetch('/api/admin/youtube-transcript');
      const data = await res.json() as { transcripts?: TranscriptRecord[] };
      setTranscripts(data.transcripts ?? []);
    } catch {
      setTranscripts([]);
    } finally {
      setLoadingTranscripts(false);
    }
  }

  useEffect(() => {
    loadTranscripts();
  }, []);

  function handleDelete(id: string) {
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20 }}>▶</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>YouTube Transcript</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Fetch, analyze and export YouTube video transcripts · {transcripts.length} saved
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', paddingLeft: 32, display: 'flex', gap: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '14px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'transparent', color: activeTab === tab ? '#dc2626' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid #dc2626' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px' }}>
        {activeTab === 'Fetch Transcript' && (
          <FetchTab onFetched={loadTranscripts} />
        )}
        {activeTab === 'All Transcripts' && (
          <AllTranscriptsTab
            transcripts={transcripts}
            loading={loadingTranscripts}
            onDelete={handleDelete}
            showToast={showToast}
          />
        )}
        {activeTab === 'Transcript Viewer' && (
          <ViewerTab transcripts={transcripts} showToast={showToast} />
        )}
        {activeTab === 'AI Analysis' && (
          <AIAnalysisTab transcripts={transcripts} showToast={showToast} />
        )}
        {activeTab === 'Batch Processing' && (
          <BatchTab onFetched={loadTranscripts} />
        )}
      </div>
    </div>
  );
}
