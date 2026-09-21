'use client';

import { useState, useEffect } from 'react';

interface TranscriptionJob {
  id: number;
  job_number: string;
  source_type: string;
  source_url: string | null;
  source_filename: string | null;
  language: string;
  output_format: string;
  include_timestamps: boolean;
  include_speaker_labels: boolean;
  model_used: string;
  status: string;
  transcript_preview: string | null;
  word_count: number | null;
  duration_seconds: number | null;
  created_at: string;
  completed_at: string | null;
}

const LANGUAGES = ['Auto-detect', 'English', 'French', 'Spanish', 'Hindi', 'Mandarin', 'Arabic', 'German', 'Portuguese', 'Japanese'];
const OUTPUT_FORMATS = ['Plain Text', 'SRT Subtitles', 'VTT Subtitles', 'JSON (with timestamps)', 'Word Document'];

export default function VideoToTextPage() {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [activeTab, setActiveTab] = useState<'transcribe' | 'history' | 'ai'>('transcribe');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [language, setLanguage] = useState('Auto-detect');
  const [outputFormat, setOutputFormat] = useState('Plain Text');
  const [includeTimestamps, setIncludeTimestamps] = useState(true);
  const [includeSpeakers, setIncludeSpeakers] = useState(false);
  const [result, setResult] = useState('');
  const [selectedJob, setSelectedJob] = useState<TranscriptionJob | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/video-to-text')
      .then(r => r.json())
      .then(d => setJobs(d.items || []))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!sourceUrl.trim() && sourceType === 'url') return;
    setSubmitting(true);
    setResult('');
    try {
      const res = await fetch('/api/admin/video-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: sourceType, source_url: sourceUrl, language, output_format: outputFormat, include_timestamps: includeTimestamps, include_speaker_labels: includeSpeakers }),
      });
      const d = await res.json();
      setResult(d.message || 'Transcription queued');
      setJobs(prev => [d.job, ...prev].filter(Boolean));
      setSourceUrl('');
    } catch { setResult('Failed to queue job'); } finally { setSubmitting(false); }
  };

  const runAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt }) });
      const d = await res.json();
      setAiResponse(d.text || d.error || 'No response');
    } catch { setAiResponse('AI unavailable'); } finally { setAiLoading(false); }
  };

  const statusColor = (s: string) => ({ queued: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' }[s] || 'bg-gray-100 text-gray-600');

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Video to Text</h1>
        <p className="text-gray-600 mt-1">Transcribe video and audio to text — subtitles, meeting notes, content repurposing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Jobs', value: jobs.length, color: 'bg-teal-500' },
          { label: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: 'bg-green-500' },
          { label: 'Total Words', value: jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.word_count || 0), 0).toLocaleString(), color: 'bg-blue-500' },
          { label: 'Processing', value: jobs.filter(j => j.status === 'processing').length, color: 'bg-yellow-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div className={`w-8 h-8 ${s.color} rounded-lg mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {(['transcribe', 'history', 'ai'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ai' ? 'AI Post-Processing' : t === 'history' ? 'Job History' : 'New Transcription'}
          </button>
        ))}
      </div>

      {activeTab === 'transcribe' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">New Transcription Job</h2>
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              {(['url', 'upload'] as const).map(t => (
                <button key={t} onClick={() => setSourceType(t)} className={`px-3 py-1.5 rounded text-sm font-medium ${sourceType === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'url' ? 'URL / YouTube' : 'Upload File'}
                </button>
              ))}
            </div>
            {sourceType === 'url' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video / Audio URL</label>
                <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or direct .mp4 / .mp3 URL" className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                <p className="text-sm text-gray-500">File upload coming soon — use URL mode for now</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Output Format</label>
                <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {OUTPUT_FORMATS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={includeTimestamps} onChange={e => setIncludeTimestamps(e.target.checked)} className="rounded" />
                Include timestamps
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={includeSpeakers} onChange={e => setIncludeSpeakers(e.target.checked)} className="rounded" />
                Speaker diarization
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={submit} disabled={submitting || (sourceType === 'url' && !sourceUrl.trim())} className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {submitting ? 'Queuing...' : 'Start Transcription'}
              </button>
              {result && <p className="text-sm text-green-600">{result}</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Transcription History</h2>
          </div>
          {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No jobs yet. Start your first transcription above.</div>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>{['#', 'Source', 'Language', 'Format', 'Words', 'Duration', 'Status', 'Created'].map(h => <th key={h} className="px-4 py-3 text-left text-gray-600 font-medium text-xs">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {jobs.map(j => (
                    <tr key={j.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedJob(selectedJob?.id === j.id ? null : j)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{j.job_number}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate text-xs">{j.source_url || j.source_filename || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{j.language}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{j.output_format}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{j.word_count?.toLocaleString() || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{j.duration_seconds ? `${Math.round(j.duration_seconds / 60)}m` : '—'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(j.status)}`}>{j.status}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedJob?.transcript_preview && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 mb-2">Transcript Preview</p>
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{selectedJob.transcript_preview}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">AI Post-Processing</h2>
          <p className="text-sm text-gray-500 mb-4">Paste a transcript and ask AI to summarize, extract key points, clean up filler words, generate blog posts, or create social captions.</p>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Paste transcript + instruction. e.g. 'Summarize this yoga class transcript into 5 key teaching points for a blog post: [paste transcript here]'" className="w-full border border-gray-200 rounded-lg p-3 text-sm h-40 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <button onClick={runAI} disabled={aiLoading} className="mt-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">{aiLoading ? 'Processing...' : 'Process with AI'}</button>
          {aiResponse && <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg"><p className="text-sm text-gray-800 whitespace-pre-wrap">{aiResponse}</p></div>}
        </div>
      )}
    </div>
  );
}
