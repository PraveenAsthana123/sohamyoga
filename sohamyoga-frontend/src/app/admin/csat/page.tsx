'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

type Survey = {
  id: string; name: string; trigger_event: string; question_text: string;
  scale: number; follow_up_question: string | null; status: string;
  total_responses: number; avg_score: string | null;
  distribution_json: Record<string, number>;
  detractor_count: string; promoter_count: string; created_at: string;
};

type CsatResponse = {
  id: string; survey_id: string; survey_name?: string;
  customer_email: string | null; customer_name: string | null;
  score: number; follow_up_text: string | null; sentiment: string | null;
  entities_json: Array<{ type: string; value: string }>;
  complaint_category: string | null; complaint_severity: string | null;
  is_escalated: boolean; escalation_reason: string | null; escalation_level: string | null;
  legal_flag: boolean; legal_notes: string | null;
  responded: boolean; response_text: string | null;
  source: string; created_at: string;
};

type Escalation = {
  id: string; response_id: string; escalation_type: string;
  reason: string | null; assigned_to: string | null; status: string;
  resolution_text: string | null; resolved_at: string | null;
  customer_name: string | null; customer_email: string | null;
  score: number; follow_up_text: string | null;
  survey_name: string; hours_open: number; created_at: string;
};

type AnalysisResult = {
  categories: Array<{ name: string; count: number; pct: number }>;
  entities: Array<{ type: string; value: string; frequency: number }>;
  themes: string[];
  recommendations: string[];
  processed_count: number;
  total_responses: number;
};

type PageData = {
  surveys: Survey[];
  recentResponses: CsatResponse[];
  openEscalations: number;
  legalFlags: number;
  overallAvgScore: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────

const TABS = ['dashboard', 'responses', 'ai-analysis', 'escalations', 'survey-builder'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  'dashboard': 'Dashboard',
  'responses': 'Responses',
  'ai-analysis': 'AI Analysis',
  'escalations': 'Escalations',
  'survey-builder': 'Survey Builder',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-gray-100 text-gray-700',
  negative: 'bg-red-100 text-red-700',
};
const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800 font-bold',
};
const ESCALATION_COLORS: Record<string, string> = {
  manager: 'bg-blue-100 text-blue-700',
  legal: 'bg-red-100 text-red-700',
  executive: 'bg-purple-100 text-purple-700',
  refund: 'bg-amber-100 text-amber-700',
};
const TRIGGER_OPTIONS = ['post_purchase', 'post_service', 'post_event', 'post_support', 'periodic'];
const SOURCE_LABELS: Record<string, string> = {
  email: 'Email', sms: 'SMS', web: 'Web', qr: 'QR', in_app: 'In-App'
};

function scoreColor(avg: number): string {
  if (avg >= 4) return 'text-green-600';
  if (avg >= 3) return 'text-amber-600';
  return 'text-red-600';
}
function stars(score: number, scale: number = 5): string {
  const filled = Math.round(score);
  return '★'.repeat(filled) + '☆'.repeat(scale - filled);
}
function timeAgo(dt: string): string {
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Escalate Modal ─────────────────────────────────────────────────────────

function EscalateModal({
  responseId, onClose, onDone
}: { responseId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('manager');
  const [reason, setReason] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/csat/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id: responseId, escalation_type: type, reason, assigned_to: assignedTo }),
      });
      if (!res.ok) { const d = await res.json(); setErr(d.error || 'Failed'); setLoading(false); return; }
      onDone();
    } catch { setErr('Network error'); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">Escalate Response</h3>
        {err && <div className="mb-3 text-red-600 text-sm">{err}</div>}
        <label className="block text-sm font-medium mb-1">Escalation Type</label>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-3 text-sm">
          <option value="manager">Manager</option>
          <option value="legal">Legal</option>
          <option value="executive">Executive</option>
          <option value="refund">Refund</option>
        </select>
        <label className="block text-sm font-medium mb-1">Reason</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-3 text-sm" rows={3} placeholder="Reason for escalation..." />
        <label className="block text-sm font-medium mb-1">Assign To</label>
        <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4 text-sm" placeholder="manager@example.com" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Escalating...' : 'Escalate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Resolve Modal ───────────────────────────────────────────────────────────

function ResolveModal({ esc, onClose, onDone }: { esc: Escalation; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await fetch('/api/admin/csat/escalate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: esc.id, status: 'resolved', resolution_text: text }),
      });
      onDone();
    } catch { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">Resolve Escalation</h3>
        <p className="text-sm text-gray-600 mb-3">Customer: <strong>{esc.customer_name || esc.customer_email}</strong></p>
        <label className="block text-sm font-medium mb-1">Resolution Notes</label>
        <textarea value={text} onChange={e => setText(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4 text-sm" rows={4} placeholder="Describe how this was resolved..." />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Resolving...' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CsatPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Responses tab state
  const [responses, setResponses] = useState<CsatResponse[]>([]);
  const [respTotal, setRespTotal] = useState(0);
  const [respFilter, setRespFilter] = useState({ survey: '', score: '', sentiment: '', escalated: '' });
  const [respLoading, setRespLoading] = useState(false);
  const [escalateResponseId, setEscalateResponseId] = useState<string | null>(null);
  const [aiReplyMap, setAiReplyMap] = useState<Record<string, string>>({});
  const [aiReplyLoading, setAiReplyLoading] = useState<string | null>(null);

  // Analysis tab state
  const [analysisSurveyId, setAnalysisSurveyId] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisErr, setAnalysisErr] = useState('');

  // Escalations tab state
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [escLoading, setEscLoading] = useState(false);
  const [resolveEsc, setResolveEsc] = useState<Escalation | null>(null);

  // Survey builder state
  const [newSurvey, setNewSurvey] = useState({ name: '', trigger_event: 'post_purchase', question_text: 'How satisfied were you with your experience?', scale: 5, follow_up_question: '' });
  const [buildLoading, setBuildLoading] = useState(false);
  const [buildMsg, setBuildMsg] = useState('');

  const fetchMain = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin/csat');
      if (!res.ok) throw new Error('Failed to load');
      const d = await res.json() as PageData;
      setData(d);
      if (!analysisSurveyId && d.surveys.length) setAnalysisSurveyId(d.surveys[0].id);
    } catch { setErr('Failed to load CSAT data'); }
    setLoading(false);
  }, [analysisSurveyId]);

  const fetchResponses = useCallback(async () => {
    if (!data) return;
    setRespLoading(true);
    try {
      const survey = respFilter.survey || (data.surveys[0]?.id || '');
      if (!survey) { setResponses([]); setRespLoading(false); return; }
      const params = new URLSearchParams();
      if (respFilter.score) params.set('score', respFilter.score);
      if (respFilter.sentiment) params.set('sentiment', respFilter.sentiment);
      if (respFilter.escalated) params.set('escalated', respFilter.escalated);
      const res = await fetch(`/api/admin/csat/${survey}/responses?${params}`);
      const d = await res.json() as { responses: CsatResponse[]; total: number };
      setResponses(d.responses || []);
      setRespTotal(d.total || 0);
    } catch { /* silently fail */ }
    setRespLoading(false);
  }, [data, respFilter]);

  const fetchEscalations = useCallback(async () => {
    setEscLoading(true);
    try {
      const res = await fetch('/api/admin/csat/escalate');
      const d = await res.json() as { escalations: Escalation[] };
      setEscalations(d.escalations || []);
    } catch { /* silently fail */ }
    setEscLoading(false);
  }, []);

  useEffect(() => { fetchMain(); }, [fetchMain]);
  useEffect(() => { if (tab === 'responses' && data) fetchResponses(); }, [tab, data, fetchResponses]);
  useEffect(() => { if (tab === 'escalations') fetchEscalations(); }, [tab, fetchEscalations]);

  async function runAnalysis() {
    if (!analysisSurveyId) return;
    setAnalysisLoading(true); setAnalysisErr(''); setAnalysisResult(null);
    try {
      const res = await fetch(`/api/admin/csat/${analysisSurveyId}/analyze`, { method: 'POST' });
      if (!res.ok) { const d = await res.json() as { error?: string }; setAnalysisErr(d.error || 'Analysis failed'); setAnalysisLoading(false); return; }
      const d = await res.json() as AnalysisResult;
      setAnalysisResult(d);
    } catch { setAnalysisErr('Network error'); }
    setAnalysisLoading(false);
  }

  async function getAiReply(r: CsatResponse) {
    setAiReplyLoading(r.id);
    try {
      const res = await fetch(`${window.location.origin}/api/admin/csat/${r.survey_id}/analyze`, { method: 'POST' });
      // Use simple fallback for individual reply
      const body = `Write a brief empathetic professional response to this ${r.score}-star customer review: "${r.follow_up_text || 'No comment provided.'}" Keep it under 100 words.`;
      const ollamaRes = await fetch('/api/mcp/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: body }),
      }).catch(() => null);
      if (ollamaRes && ollamaRes.ok) {
        const d = await ollamaRes.json() as { result?: string };
        setAiReplyMap(prev => ({ ...prev, [r.id]: d.result || '' }));
      } else {
        const score = r.score;
        const fallback = score >= 4
          ? `Thank you so much for your wonderful feedback! We're thrilled you had a great experience and look forward to seeing you again.`
          : score === 3
            ? `Thank you for your feedback. We appreciate your honest review and are always working to improve. Please reach out if you have any specific suggestions.`
            : `We sincerely apologize for your experience. This is not the standard we hold ourselves to. Please contact us directly at support@sohamyoga.com so we can make this right.`;
        setAiReplyMap(prev => ({ ...prev, [r.id]: fallback }));
      }
    } catch {
      setAiReplyMap(prev => ({ ...prev, [r.id]: 'Unable to generate AI reply at this time.' }));
    }
    setAiReplyLoading(null);
  }

  async function toggleLegalFlag(r: CsatResponse) {
    try {
      await fetch('/api/admin/csat/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_id: r.id, escalation_type: 'legal', reason: 'Legal flag set by admin' }),
      });
      fetchResponses();
    } catch { /* ignore */ }
  }

  async function createSurvey() {
    setBuildLoading(true); setBuildMsg('');
    try {
      const res = await fetch('/api/admin/csat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSurvey),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setBuildMsg(d.error || 'Failed to create'); setBuildLoading(false); return; }
      setBuildMsg('Survey created successfully!');
      setNewSurvey({ name: '', trigger_event: 'post_purchase', question_text: 'How satisfied were you with your experience?', scale: 5, follow_up_question: '' });
      fetchMain();
    } catch { setBuildMsg('Network error'); }
    setBuildLoading(false);
  }

  // ─── Dashboard Tab ─────────────────────────────────────────────────────────

  function renderDashboard() {
    if (!data) return null;
    const avgScore = parseFloat(data.overallAvgScore) || 0;
    const totalResp = data.surveys.reduce((s, sv) => s + sv.total_responses, 0);
    const promoters = data.surveys.reduce((s, sv) => s + parseInt(sv.promoter_count || '0'), 0);
    const detractors = data.surveys.reduce((s, sv) => s + parseInt(sv.detractor_count || '0'), 0);
    const npsEquiv = totalResp > 0 ? Math.round(((promoters - detractors) / totalResp) * 100) : 0;
    const recentLow = data.recentResponses.filter(r => r.score <= 2);

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Overall CSAT', value: `${avgScore.toFixed(1)} / ${data.surveys[0]?.scale || 5}`, sub: scoreColor(avgScore) },
            { label: 'NPS Equivalent', value: `${npsEquiv > 0 ? '+' : ''}${npsEquiv}`, sub: npsEquiv >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'Total Responses', value: totalResp.toLocaleString(), sub: 'text-gray-700' },
            { label: 'Promoters (4-5★)', value: promoters.toLocaleString(), sub: 'text-green-600' },
            { label: 'Detractors (1-2★)', value: detractors.toLocaleString(), sub: 'text-red-600' },
            { label: 'Open Escalations', value: data.openEscalations, sub: data.openEscalations > 0 ? 'text-orange-600' : 'text-gray-700' },
            { label: 'Legal Flags', value: data.legalFlags, sub: data.legalFlags > 0 ? 'text-red-700 font-bold' : 'text-gray-700' },
            { label: 'Active Surveys', value: data.surveys.filter(s => s.status === 'active').length, sub: 'text-blue-600' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
              <div className={`text-2xl font-bold ${kpi.sub}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* CSAT Gauge */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center">
          <div className="text-4xl font-black mb-1 ${scoreColor(avgScore)}">
            <span className={scoreColor(avgScore)}>{avgScore.toFixed(1)}</span>
            <span className="text-gray-400 text-2xl"> / {data.surveys[0]?.scale || 5}</span>
          </div>
          <div className="text-sm text-gray-500 mb-4">Overall CSAT Score</div>
          <div className="w-full bg-gray-100 rounded-full h-4 mb-2">
            <div
              className={`h-4 rounded-full ${avgScore >= 4 ? 'bg-green-500' : avgScore >= 3 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${(avgScore / (data.surveys[0]?.scale || 5)) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-400">{avgScore >= 4 ? 'Excellent' : avgScore >= 3 ? 'Needs Improvement' : 'Critical — Immediate Action Required'}</div>
        </div>

        {/* Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Score Distribution (all surveys)</h3>
          {[5, 4, 3, 2, 1].map(score => {
            const count = data.surveys.reduce((s, sv) => s + (sv.distribution_json?.[score.toString()] || 0), 0);
            const pct = totalResp > 0 ? (count / totalResp) * 100 : 0;
            return (
              <div key={score} className="flex items-center gap-3 mb-2">
                <span className="w-8 text-sm font-medium text-amber-500">{score}★</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5">
                  <div
                    className={`h-5 rounded-full ${score >= 4 ? 'bg-green-500' : score === 3 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-20 text-xs text-gray-500 text-right">{count} ({pct.toFixed(1)}%)</span>
              </div>
            );
          })}
        </div>

        {/* Recent Low-Score Alerts */}
        {recentLow.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-semibold text-red-700 mb-3">Recent Low-Score Alerts (≤2★ last 7 days)</h3>
            <div className="space-y-2">
              {recentLow.map(r => (
                <div key={r.id} className="flex items-start gap-3 bg-white border border-red-200 rounded-lg p-3">
                  <span className="text-red-600 font-bold text-lg">{r.score}★</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.customer_name || r.customer_email || 'Anonymous'}</div>
                    <div className="text-xs text-gray-500 truncate">{r.follow_up_text || 'No comment'}</div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(r.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Surveys Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-800 text-sm">All Surveys</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Survey', 'Trigger', 'Scale', 'Responses', 'Avg Score', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {data.surveys.map(s => (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.trigger_event.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">1-{s.scale}</td>
                  <td className="px-4 py-3">{s.total_responses}</td>
                  <td className={`px-4 py-3 font-bold ${scoreColor(parseFloat(s.avg_score || '0'))}`}>{s.avg_score ? parseFloat(s.avg_score).toFixed(1) : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Responses Tab ─────────────────────────────────────────────────────────

  function renderResponses() {
    const surveys = data?.surveys || [];
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Survey</label>
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={respFilter.survey} onChange={e => setRespFilter(p => ({ ...p, survey: e.target.value }))}>
              <option value="">All Surveys</option>
              {surveys.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Score</label>
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={respFilter.score} onChange={e => setRespFilter(p => ({ ...p, score: e.target.value }))}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}★</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sentiment</label>
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={respFilter.sentiment} onChange={e => setRespFilter(p => ({ ...p, sentiment: e.target.value }))}>
              <option value="">Any</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Escalated</label>
            <select className="border rounded-lg px-3 py-1.5 text-sm" value={respFilter.escalated} onChange={e => setRespFilter(p => ({ ...p, escalated: e.target.value }))}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <button onClick={fetchResponses} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Apply</button>
        </div>
        <div className="text-xs text-gray-500">{respTotal} responses found</div>
        {respLoading && <div className="text-center text-gray-400 py-8">Loading responses...</div>}
        <div className="space-y-3">
          {responses.map(r => (
            <div key={r.id} className={`bg-white rounded-xl border shadow-sm p-4 ${r.legal_flag ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-gray-900">{r.customer_name || 'Anonymous'}</span>
                    {r.customer_email && <span className="text-xs text-gray-400">{r.customer_email}</span>}
                    <span className="text-amber-500 font-bold">{stars(r.score)}</span>
                    <span className="text-xs text-gray-400">{SOURCE_LABELS[r.source] || r.source}</span>
                    {r.sentiment && <span className={`px-2 py-0.5 rounded-full text-xs ${SENTIMENT_COLORS[r.sentiment] || 'bg-gray-100 text-gray-600'}`}>{r.sentiment}</span>}
                    {r.complaint_category && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{r.complaint_category}</span>}
                    {r.complaint_severity && <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_COLORS[r.complaint_severity] || ''}`}>{r.complaint_severity}</span>}
                    {r.is_escalated && <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Escalated</span>}
                    {r.legal_flag && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">⚠️ Legal</span>}
                  </div>
                  {r.follow_up_text && <p className="text-sm text-gray-700 mt-1">{r.follow_up_text}</p>}
                  {/* Entity chips */}
                  {r.entities_json && r.entities_json.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.entities_json.map((e, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">{e.type}: {e.value}</span>
                      ))}
                    </div>
                  )}
                  {/* AI Reply */}
                  {aiReplyMap[r.id] && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-gray-700">
                      <div className="text-xs font-medium text-indigo-600 mb-1">AI Suggested Reply:</div>
                      {aiReplyMap[r.id]}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => setEscalateResponseId(r.id)} className="px-3 py-1 text-xs border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50">Escalate</button>
                  <button onClick={() => getAiReply(r)} disabled={aiReplyLoading === r.id} className="px-3 py-1 text-xs border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50">
                    {aiReplyLoading === r.id ? '...' : 'AI Reply'}
                  </button>
                  {!r.legal_flag && (
                    <button onClick={() => toggleLegalFlag(r)} className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Legal Flag</button>
                  )}
                  <span className="text-xs text-gray-400 text-center">{timeAgo(r.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
          {!respLoading && responses.length === 0 && (
            <div className="text-center text-gray-400 py-12">No responses match the current filters.</div>
          )}
        </div>
        {escalateResponseId && (
          <EscalateModal
            responseId={escalateResponseId}
            onClose={() => setEscalateResponseId(null)}
            onDone={() => { setEscalateResponseId(null); fetchResponses(); fetchMain(); }}
          />
        )}
      </div>
    );
  }

  // ─── AI Analysis Tab ───────────────────────────────────────────────────────

  function renderAnalysis() {
    const surveys = data?.surveys || [];
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">AI-Powered Analysis</h3>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Select Survey</label>
              <select className="border rounded-lg px-3 py-2 text-sm" value={analysisSurveyId} onChange={e => { setAnalysisSurveyId(e.target.value); setAnalysisResult(null); }}>
                {surveys.map(s => <option key={s.id} value={s.id}>{s.name} ({s.total_responses} responses)</option>)}
              </select>
            </div>
            <button onClick={runAnalysis} disabled={analysisLoading || !analysisSurveyId} className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {analysisLoading ? 'Analyzing with AI...' : 'Run AI Analysis'}
            </button>
          </div>
          {analysisErr && <div className="text-red-600 text-sm mb-3">{analysisErr}</div>}
          {analysisResult && (
            <div className="space-y-5">
              <div className="text-xs text-gray-500">Analyzed {analysisResult.total_responses} responses · {analysisResult.processed_count} newly classified</div>
              {/* Categories */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Top Complaint Categories</h4>
                <div className="space-y-2">
                  {analysisResult.categories.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-24 text-sm capitalize">{c.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4">
                        <div className="h-4 rounded-full bg-indigo-500" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{c.count} ({c.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Entity cloud */}
              {analysisResult.entities.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 text-sm">Mentioned Entities</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.entities.map((e, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-sm border border-indigo-200 bg-indigo-50 text-indigo-700">
                        {e.type}: {e.value} <span className="font-bold">×{e.frequency}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Themes */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Key Themes</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {analysisResult.themes.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
              {/* Recommendations */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Recommended Actions</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                  {analysisResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Escalations Tab ───────────────────────────────────────────────────────

  function renderEscalations() {
    const now = Date.now();
    const legalEscs = escalations.filter(e => e.escalation_type === 'legal');
    const openEscs = escalations.filter(e => e.status === 'open' || e.status === 'in_progress');
    return (
      <div className="space-y-5">
        {/* Open Escalations */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Escalation Queue ({openEscs.length} open)</h3>
          </div>
          {escLoading && <div className="text-center py-8 text-gray-400">Loading...</div>}
          {!escLoading && openEscs.length === 0 && <div className="text-center py-8 text-gray-400">No open escalations</div>}
          <div className="divide-y divide-gray-50">
            {openEscs.map(esc => {
              const hoursOpen = esc.hours_open || 0;
              const slaBg = hoursOpen > 72 ? 'bg-red-50' : hoursOpen > 48 ? 'bg-amber-50' : '';
              return (
                <div key={esc.id} className={`px-5 py-4 flex items-start gap-4 flex-wrap ${slaBg}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm">{esc.customer_name || esc.customer_email || 'Unknown'}</span>
                      <span className="text-amber-500 text-sm">{stars(esc.score)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${ESCALATION_COLORS[esc.escalation_type] || 'bg-gray-100 text-gray-600'}`}>{esc.escalation_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${esc.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{esc.status}</span>
                      {hoursOpen > 72 && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">SLA Breach ({Math.round(hoursOpen)}h)</span>}
                      {hoursOpen > 48 && hoursOpen <= 72 && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">SLA Warning</span>}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">Assigned to: {esc.assigned_to || 'Unassigned'} · Survey: {esc.survey_name}</div>
                    {esc.reason && <div className="text-sm text-gray-700">{esc.reason}</div>}
                    {esc.follow_up_text && <div className="text-xs text-gray-500 mt-1 italic">&ldquo;{esc.follow_up_text}&rdquo;</div>}
                  </div>
                  <button onClick={() => setResolveEsc(esc)} className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Resolve</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legal Escalations */}
        {legalEscs.length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-red-100 bg-red-50">
              <h3 className="font-semibold text-red-700">⚠️ Legal Escalations ({legalEscs.length})</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {legalEscs.map(esc => (
                <div key={esc.id} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{esc.customer_name || esc.customer_email}</span>
                    <span className="text-amber-500 text-sm">{stars(esc.score)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${esc.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{esc.status}</span>
                  </div>
                  <div className="text-sm text-gray-700 mb-2">{esc.follow_up_text}</div>
                  <div className="text-xs text-gray-500">{esc.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {resolveEsc && (
          <ResolveModal esc={resolveEsc} onClose={() => setResolveEsc(null)} onDone={() => { setResolveEsc(null); fetchEscalations(); fetchMain(); }} />
        )}
      </div>
    );
  }

  // ─── Survey Builder Tab ────────────────────────────────────────────────────

  function renderBuilder() {
    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://sohamyoga.com';
    return (
      <div className="space-y-5">
        {/* Create Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Create New Survey</h3>
          {buildMsg && <div className={`mb-3 text-sm p-3 rounded-lg ${buildMsg.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{buildMsg}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Survey Name *</label>
              <input value={newSurvey.name} onChange={e => setNewSurvey(p => ({ ...p, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Post-Class Survey" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Trigger Event</label>
              <select value={newSurvey.trigger_event} onChange={e => setNewSurvey(p => ({ ...p, trigger_event: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                {TRIGGER_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Question Text</label>
              <input value={newSurvey.question_text} onChange={e => setNewSurvey(p => ({ ...p, question_text: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scale</label>
              <select value={newSurvey.scale} onChange={e => setNewSurvey(p => ({ ...p, scale: parseInt(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value={5}>1-5</option>
                <option value={10}>1-10</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Follow-up Question</label>
              <input value={newSurvey.follow_up_question} onChange={e => setNewSurvey(p => ({ ...p, follow_up_question: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="What could we improve?" />
            </div>
          </div>
          <button onClick={createSurvey} disabled={buildLoading || !newSurvey.name.trim()} className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {buildLoading ? 'Creating...' : 'Create Survey'}
          </button>
        </div>

        {/* Survey Preview */}
        {newSurvey.question_text && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Preview</div>
            <div className="bg-white rounded-xl border p-6 max-w-md">
              <h4 className="font-semibold text-gray-800 mb-3">{newSurvey.question_text}</h4>
              <div className="flex gap-2 mb-4">
                {Array.from({ length: newSurvey.scale }, (_, i) => i + 1).map(n => (
                  <button key={n} className="w-10 h-10 rounded-lg border-2 border-gray-200 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 text-sm font-medium">{n}</button>
                ))}
              </div>
              {newSurvey.follow_up_question && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">{newSurvey.follow_up_question}</p>
                  <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Your feedback..." readOnly />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing Surveys Links */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">Shareable Survey Links</h3>
          <div className="space-y-3">
            {(data?.surveys || []).map(s => {
              const url = `${domain}/survey/${s.id}`;
              return (
                <div key={s.id} className="border rounded-lg p-3">
                  <div className="font-medium text-sm mb-1">{s.name}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{url}</code>
                    <a href={`https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">QR Code</a>
                    <button onClick={() => navigator.clipboard.writeText(url)} className="text-xs border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50">Copy</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Email Template */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">Email Template</h3>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap">{`Subject: We'd love your feedback — quick 30-second survey

Dear {customer_name},

Thank you for choosing Soham Yoga! Your experience matters deeply to us.

We'd love to hear about your recent visit. Please take 30 seconds to share your feedback:

{survey_link}

Your honest feedback helps us serve you better.

With gratitude,
The Soham Yoga Team`}</div>
          <div className="mt-3">
            <div className="text-xs font-medium text-gray-500 mb-1">SMS Template (Twilio)</div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 font-mono">{`Hi {name}! How was your Soham Yoga experience? Rate us: {survey_link} (Reply STOP to opt out)`}</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading CSAT data...</div>
  );
  if (err) return (
    <div className="p-8 text-center text-red-600">{err} <button onClick={fetchMain} className="ml-2 underline">Retry</button></div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CSAT & Complaint Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Customer satisfaction tracking, AI analysis, and escalation management</p>
        </div>
        <button onClick={fetchMain} className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'dashboard' && renderDashboard()}
      {tab === 'responses' && renderResponses()}
      {tab === 'ai-analysis' && renderAnalysis()}
      {tab === 'escalations' && renderEscalations()}
      {tab === 'survey-builder' && renderBuilder()}
    </div>
  );
}
