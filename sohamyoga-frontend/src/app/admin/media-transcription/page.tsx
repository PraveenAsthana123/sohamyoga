'use client';
import { useEffect, useState, useCallback } from 'react';

const TABS = ['dashboard', 'upload', 'viewer', 'translate', 'minutes'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  upload: 'Upload & Process',
  viewer: 'Transcript Viewer',
  translate: 'Translate & Export',
  minutes: 'Meeting Minutes',
};

interface TranscriptionJob {
  id: number;
  title: string;
  source_type: string;
  file_name: string | null;
  source_url: string | null;
  duration_seconds: number;
  language: string;
  status: string;
  word_count: number;
  created_at: string;
  completed_at: string | null;
  transcript_preview?: string;
}

interface Stats {
  total: string;
  queued: string;
  in_progress: string;
  completed: string;
  total_words: string;
  avg_completion_minutes: string;
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const SOURCE_ICONS: Record<string, string> = {
  upload: '📁',
  youtube: '▶',
  recording: '🎙',
  meeting: '📅',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function KpiCard({ label, value, sub, border }: { label: string; value: string | number; sub?: string; border: string }) {
  return (
    <div className={`rounded-lg p-4 ${border}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function MediaTranscriptionPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [jobDetail, setJobDetail] = useState<{ job: TranscriptionJob & { transcript_text?: string; summary?: string; chapters?: { title: string; timestamp: string; summary: string }[]; action_items?: { item: string; owner: string; due_date: string }[] }; exports: { format: string; created_at: string }[]; translations: { target_language: string; translated_text: string; created_at: string }[] } | null>(null);
  const [summaryData, setSummaryData] = useState<{ summary: string; chapters: { title: string; timestamp: string; summary: string }[]; action_items: { item: string; owner: string; due_date: string }[] } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportContent, setExportContent] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<string>('txt');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [translatedText, setTranslatedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState('');

  // Form state
  const [form, setForm] = useState({ title: '', source_type: 'upload', source_url: '', file_name: '', language: 'en' });
  const [ytUrl, setYtUrl] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytSubmitting, setYtSubmitting] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/media-transcription', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as { jobs: TranscriptionJob[]; stats: Stats };
        setJobs(data.jobs);
        setStats(data.stats);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const loadJobDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/admin/media-transcription/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json() as typeof jobDetail;
      setJobDetail(data);
      setSummaryData(null);
      setTranslatedText('');
      setExportContent('');
    }
  }, []);

  useEffect(() => {
    if (selectedJobId) loadJobDetail(selectedJobId);
  }, [selectedJobId, loadJobDetail]);

  const processJob = async (id: number) => {
    setProcessing(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/media-transcription/${id}/process`, { method: 'POST' });
      if (res.ok) { setMsg('Processed successfully!'); await loadJobs(); if (selectedJobId === id) await loadJobDetail(id); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setProcessing(false); }
  };

  const summarizeJob = async () => {
    if (!selectedJobId) return;
    setSummarizing(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/media-transcription/${selectedJobId}/summarize`, { method: 'POST' });
      if (res.ok) {
        const d = await res.json() as { summary: string; chapters: { title: string; timestamp: string; summary: string }[]; action_items: { item: string; owner: string; due_date: string }[] };
        setSummaryData(d);
        setMsg('Summary generated!');
      } else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setSummarizing(false); }
  };

  const translateJob = async () => {
    if (!selectedJobId) return;
    setTranslating(true);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/media-transcription/${selectedJobId}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_language: targetLang }),
      });
      if (res.ok) { const d = await res.json() as { translated_text: string }; setTranslatedText(d.translated_text); setMsg('Translation complete!'); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setTranslating(false); }
  };

  const exportJob = async (fmt: string) => {
    if (!selectedJobId) return;
    setExporting(true);
    setExportFormat(fmt);
    setMsg('');
    try {
      const res = await fetch(`/api/admin/media-transcription/${selectedJobId}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: fmt }),
      });
      if (res.ok) { const d = await res.json() as { content: string }; setExportContent(d.content); setMsg('Export ready!'); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setExporting(false); }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/media-transcription', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) { setMsg('Job created!'); setForm({ title: '', source_type: 'upload', source_url: '', file_name: '', language: 'en' }); await loadJobs(); }
    else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
  };

  const submitYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtSubmitting(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/media-transcription/youtube', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl, title: ytTitle }),
      });
      if (res.ok) { setMsg('YouTube transcript created!'); setYtUrl(''); setYtTitle(''); await loadJobs(); }
      else { const d = await res.json() as { error?: string }; setMsg(d.error || 'Error'); }
    } finally { setYtSubmitting(false); }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const meetingJobs = jobs.filter(j => j.source_type === 'meeting');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Media Transcription</h1>
        <p className="text-slate-300 text-sm mt-0.5">UC04-08 — Video/audio transcription, YouTube, meeting minutes, subtitle translation</p>
      </div>

      <div className="border-b border-gray-200 bg-white px-6">
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="mx-6 mt-4 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800 text-sm">{msg}</div>
      )}

      <div className="p-6">
        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {loading ? <p className="text-gray-400 text-sm">Loading…</p> : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard label="Total Jobs" value={stats?.total ?? 0} border="border-l-4 border-blue-500 bg-blue-50" />
                  <KpiCard label="Completed" value={stats?.completed ?? 0} border="border-l-4 border-green-500 bg-green-50" />
                  <KpiCard label="In Queue" value={parseInt(stats?.queued ?? '0') + parseInt(stats?.in_progress ?? '0')} border="border-l-4 border-yellow-500 bg-yellow-50" />
                  <KpiCard label="Total Words" value={parseInt(stats?.total_words ?? '0').toLocaleString()} sub="across all transcripts" border="border-l-4 border-purple-500 bg-purple-50" />
                </div>
                <div className="bg-white rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100 font-medium text-sm">Recent Jobs</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left">Title</th>
                          <th className="px-4 py-2 text-left">Type</th>
                          <th className="px-4 py-2 text-left">Language</th>
                          <th className="px-4 py-2 text-left">Words</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2 text-left">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {jobs.map(j => (
                          <tr key={j.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium">{SOURCE_ICONS[j.source_type] || '📄'} {j.title}</td>
                            <td className="px-4 py-2 text-gray-500 capitalize">{j.source_type}</td>
                            <td className="px-4 py-2 text-gray-500">{j.language.toUpperCase()}</td>
                            <td className="px-4 py-2">{j.word_count.toLocaleString()}</td>
                            <td className="px-4 py-2"><Badge label={j.status} cls={STATUS_COLORS[j.status] || 'bg-gray-100 text-gray-600'} /></td>
                            <td className="px-4 py-2 text-gray-400">{new Date(j.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* UPLOAD & PROCESS TAB */}
        {tab === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="font-semibold mb-3">New Transcription Job</h2>
                <form onSubmit={submitForm} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Title *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Morning Yoga Class Recording" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Source Type</label>
                    <select value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                      <option value="upload">File Upload</option>
                      <option value="youtube">YouTube</option>
                      <option value="recording">Studio Recording</option>
                      <option value="meeting">Meeting Recording</option>
                    </select>
                  </div>
                  {form.source_type === 'upload' || form.source_type === 'recording' || form.source_type === 'meeting' ? (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">File Name</label>
                      <input value={form.file_name} onChange={e => setForm(f => ({ ...f, file_name: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. recording.mp4" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">URL</label>
                      <input value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="https://..." />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Language</label>
                    <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="hi">Hindi</option>
                      <option value="zh">Chinese</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700">
                    Create Job
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="font-semibold mb-3">YouTube Quick Import</h2>
                <form onSubmit={submitYoutube} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">YouTube URL *</label>
                    <input value={ytUrl} onChange={e => setYtUrl(e.target.value)} required
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="https://youtube.com/watch?v=..." />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Title (optional)</label>
                    <input value={ytTitle} onChange={e => setYtTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="Video title" />
                  </div>
                  <button type="submit" disabled={ytSubmitting}
                    className="w-full bg-red-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-60">
                    {ytSubmitting ? 'Importing…' : 'Import & Transcribe'}
                  </button>
                </form>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold mb-3">Processing Queue</h2>
              {jobs.length === 0 ? <p className="text-gray-400 text-sm">No jobs yet.</p> : (
                <div className="space-y-2">
                  {jobs.map(j => (
                    <div key={j.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50">
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{j.title}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge label={j.status} cls={STATUS_COLORS[j.status] || 'bg-gray-100 text-gray-600'} />
                          <span className="text-xs text-gray-400 capitalize">{j.source_type}</span>
                        </div>
                      </div>
                      {(j.status === 'queued' || j.status === 'in_progress') && (
                        <button onClick={() => processJob(j.id)} disabled={processing}
                          className="text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700 disabled:opacity-60">
                          {processing ? '…' : 'Process'}
                        </button>
                      )}
                      {j.status === 'completed' && <span className="text-xs text-green-600 font-medium">✓ Done</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TRANSCRIPT VIEWER TAB */}
        {tab === 'viewer' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <label className="text-sm font-medium text-gray-700">Select Job:</label>
              <select value={selectedJobId ?? ''} onChange={e => setSelectedJobId(e.target.value ? parseInt(e.target.value) : null)}
                className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">-- Choose a job --</option>
                {jobs.filter(j => j.status === 'completed').map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>

            {selectedJobId && jobDetail && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{jobDetail.job.title}</h3>
                      <span className="text-xs text-gray-400">{jobDetail.job.word_count?.toLocaleString()} words</span>
                    </div>
                    <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 max-h-64 overflow-y-auto leading-relaxed">
                      {jobDetail.job.transcript_text || <span className="text-gray-400">No transcript available.</span>}
                    </div>
                    <div className="mt-3">
                      <button onClick={summarizeJob} disabled={summarizing}
                        className="bg-purple-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-60">
                        {summarizing ? 'Summarizing…' : 'Summarize with AI'}
                      </button>
                    </div>
                  </div>
                </div>

                {(summaryData || jobDetail.job.summary) && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="font-semibold text-sm mb-2">Summary</h3>
                      <p className="text-sm text-gray-700">{summaryData?.summary || jobDetail.job.summary}</p>
                    </div>
                    {(summaryData?.chapters || jobDetail.job.chapters) && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <h3 className="font-semibold text-sm mb-2">Chapters</h3>
                        <div className="space-y-2">
                          {(summaryData?.chapters || jobDetail.job.chapters as { title: string; timestamp: string; summary: string }[] | null)?.map((ch, i) => (
                            <div key={i} className="flex gap-3 text-sm">
                              <span className="text-gray-400 font-mono text-xs w-12 shrink-0 pt-0.5">{ch.timestamp}</span>
                              <div>
                                <p className="font-medium">{ch.title}</p>
                                <p className="text-gray-500 text-xs">{ch.summary}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(summaryData?.action_items || jobDetail.job.action_items) && (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <h3 className="font-semibold text-sm mb-2">Action Items</h3>
                        <div className="space-y-2">
                          {(summaryData?.action_items || jobDetail.job.action_items as { item: string; owner: string; due_date: string }[] | null)?.map((ai, i) => (
                            <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
                              <input type="checkbox" className="mt-0.5" />
                              <div>
                                <span>{ai.item}</span>
                                <span className="text-xs text-gray-400 ml-2">— {ai.owner} · {ai.due_date}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {!selectedJobId && <p className="text-gray-400 text-sm">Select a completed job to view its transcript.</p>}
          </div>
        )}

        {/* TRANSLATE & EXPORT TAB */}
        {tab === 'translate' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <label className="text-sm font-medium text-gray-700">Select Job:</label>
              <select value={selectedJobId ?? ''} onChange={e => setSelectedJobId(e.target.value ? parseInt(e.target.value) : null)}
                className="border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">-- Choose a job --</option>
                {jobs.filter(j => j.status === 'completed').map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </div>

            {selectedJobId ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Translate</h3>
                  <div className="flex gap-2 items-center">
                    <select value={targetLang} onChange={e => setTargetLang(e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2 text-sm flex-1">
                      {['Spanish', 'French', 'German', 'Hindi', 'Chinese (Simplified)', 'Portuguese', 'Japanese', 'Arabic', 'Italian', 'Korean'].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <button onClick={translateJob} disabled={translating}
                      className="bg-indigo-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {translating ? 'Translating…' : 'Translate'}
                    </button>
                  </div>
                  {translatedText && (
                    <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 max-h-48 overflow-y-auto">
                      {translatedText}
                    </div>
                  )}
                  {jobDetail?.translations && jobDetail.translations.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Previous translations:</p>
                      {jobDetail.translations.map((t, i) => (
                        <div key={i} className="text-xs text-gray-500">{t.target_language} — {new Date(t.created_at).toLocaleDateString()}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Export</h3>
                  <div className="flex flex-wrap gap-2">
                    {['txt', 'markdown', 'json', 'srt', 'vtt'].map(fmt => (
                      <button key={fmt} onClick={() => exportJob(fmt)} disabled={exporting}
                        className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${exportFormat === fmt && exportContent ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} disabled:opacity-60`}>
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {exportContent && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400">{exportFormat.toUpperCase()} export</span>
                        <button onClick={() => copyToClipboard(exportContent)}
                          className="text-xs text-blue-600 hover:text-blue-800">{copied ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <pre className="bg-gray-900 text-green-300 rounded p-3 text-xs max-h-64 overflow-auto">{exportContent.slice(0, 2000)}{exportContent.length > 2000 ? '\n…(truncated)' : ''}</pre>
                    </div>
                  )}
                </div>
              </div>
            ) : <p className="text-gray-400 text-sm">Select a completed job above.</p>}
          </div>
        )}

        {/* MEETING MINUTES TAB */}
        {tab === 'minutes' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Showing all meeting-type transcription jobs and their extracted action items.</p>
            {meetingJobs.length === 0 ? (
              <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                No meeting recordings found. Create a job with source type = meeting.
              </div>
            ) : (
              meetingJobs.map(j => (
                <div key={j.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{j.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(j.created_at).toLocaleDateString()} · {j.word_count} words</p>
                    </div>
                    <Badge label={j.status} cls={STATUS_COLORS[j.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  {j.status === 'queued' || j.status === 'in_progress' ? (
                    <button onClick={() => processJob(j.id)} disabled={processing}
                      className="text-sm bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-60">
                      {processing ? 'Processing…' : 'Process Now'}
                    </button>
                  ) : (
                    <button onClick={() => { setSelectedJobId(j.id); setTab('viewer'); }}
                      className="text-sm text-blue-600 hover:text-blue-800">View Transcript & Action Items →</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
