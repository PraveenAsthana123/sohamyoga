"use client";
import { useEffect, useState } from "react";

interface NpsQuestionSummary {
  type: string; text: string; totalAnswers: number;
  promoters?: number; passives?: number; detractors?: number;
  sentimentCounts?: { positive: number; neutral: number; negative: number };
  textSample?: string[];
}
interface NpsSurveySummary {
  id: string; title: string; npsScore: number | null; totalResponses: number;
  completedResponses: number; category: string; questions: NpsQuestionSummary[];
}

function useNpsSummary() {
  const [surveys, setSurveys] = useState<NpsSurveySummary[] | null>(null);
  useEffect(() => {
    fetch('/api/survey/nps-summary', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSurveys(d?.surveys ?? []))
      .catch(() => setSurveys([]));
  }, []);
  return surveys;
}

interface NpsInvitationRecord { id: string; email: string; status: string; sentAt: string; completedAt?: string }
interface NpsResponseRecord { id: string; respondent: string; status: string; submittedAt?: string; npsScore?: number; consentGiven?: boolean; qualityFlags?: string[]; qualityScore?: number }

function useNpsRecords() {
  const [data, setData] = useState<{ invitations: NpsInvitationRecord[]; responses: NpsResponseRecord[] } | null>(null);
  useEffect(() => {
    fetch('/api/survey/nps-records', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d ?? { invitations: [], responses: [] }))
      .catch(() => setData({ invitations: [], responses: [] }));
  }, []);
  return data;
}

interface RealSurvey { id: string; title: string; type: string; status: string; responses: number; completion: number; nps?: number }
interface RealResponse { id: string; survey: string; respondent: string; status: string; completion: number; duration: string; submittedAt: string }
interface RealQuestion { id: string; survey: string; type: string; text: string; required: boolean; order: number; logic: boolean }
interface SurveyOverview {
  surveys: RealSurvey[]; responses: RealResponse[]; questions: RealQuestion[];
  answerDistribution: { option: string; count: number }[]; completionBuckets: { bucket: string; count: number }[];
}

// Real data for this whole dashboard (Overview/Surveys/Questions/Responses/
// Analytics) -- was exclusively MOCK_SURVEYS/MOCK_RESPONSES/MOCK_QUESTIONS
// client constants + two fully-hardcoded decorative arrays ("Top Answers",
// "Drop-off Analysis") before 2026-09-07. survey/survey_question/
// survey_response/survey_answer already had a real schema and a real
// create path (/admin/surveys) -- this dashboard just never read any of it.
function useSurveyOverview() {
  const [data, setData] = useState<SurveyOverview | null>(null);
  const load = () => fetch('/api/admin/market-research/surveys/overview', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => setData(d ?? { surveys: [], responses: [], questions: [], answerDistribution: [], completionBuckets: [] }))
    .catch(() => setData({ surveys: [], responses: [], questions: [], answerDistribution: [], completionBuckets: [] }));
  useEffect(() => { load(); }, []);
  return { data, reload: load };
}

const NPS_FLOW = [
  { label: '1. Class ends', sub: 'checked_in booking, session end time computed from real timestamps', color: 'bg-gray-50 border-gray-200 text-gray-800' },
  { label: '2. NpsInvitationJob', sub: 'Hourly — creates survey_invitation + notification_queue row', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { label: '3. Email sent', sub: 'NotificationDispatchJob delivers the /feedback link', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { label: '4. Customer submits', sub: 'POST /api/survey/[slug]/respond — score + optional reason', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { label: '5. NpsCalculationJob', sub: 'Hourly — real NPS score + Ollama sentiment on free text', color: 'bg-green-50 border-green-200 text-green-800' },
];

function ProcessFlow({ steps }: { steps: { label: string; sub: string; color: string }[] }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <h3 className="font-semibold text-gray-800 mb-4">Process Flow</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm text-center">
        {steps.map((n, i) => (
          <div key={n.label} className="flex flex-col items-center gap-1">
            <div className={`w-full border rounded-xl p-3 ${n.color}`}>
              <p className="font-semibold text-xs">{n.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{n.sub}</p>
            </div>
            {i < steps.length - 1 && <span className="text-gray-300 hidden md:block text-xs">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const NPS_STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700', opened: 'bg-cyan-100 text-cyan-700', started: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700', bounced: 'bg-red-100 text-red-700',
  submitted: 'bg-green-100 text-green-700', partial: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700',
};

function NpsRecordsSection() {
  const data = useNpsRecords();
  return (
    <div className="space-y-6">
      <ProcessFlow steps={NPS_FLOW} />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg overflow-hidden">
          <h3 className="font-semibold text-gray-800 p-4 pb-0">Invitations ({data?.invitations.length ?? 0})</h3>
          {!data || data.invitations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{data ? 'No invitations sent yet.' : 'Loading…'}</p>
          ) : (
            <table className="w-full text-sm mt-3">
              <thead className="bg-gray-50 border-y">
                <tr>{['Email', 'Status', 'Sent', 'Completed'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {data.invitations.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{i.email}</td>
                    <td className="px-4 py-2"><Badge label={i.status} colorClass={NPS_STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(i.sentAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{i.completedAt ? new Date(i.completedAt).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <h3 className="font-semibold text-gray-800 p-4 pb-0">Responses ({data?.responses.length ?? 0})</h3>
          {!data || data.responses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{data ? 'No responses submitted yet.' : 'Loading…'}</p>
          ) : (
            <table className="w-full text-sm mt-3">
              <thead className="bg-gray-50 border-y">
                <tr>{['Respondent', 'Score', 'Status', 'Submitted', 'Consent', 'Quality'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {data.responses.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{r.respondent}</td>
                    <td className="px-4 py-2 font-bold">{r.npsScore ?? '—'}</td>
                    <td className="px-4 py-2"><Badge label={r.status} colorClass={NPS_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-xs">{r.consentGiven ? <span className="text-green-600">✓</span> : <span className="text-gray-400">✗</span>}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.qualityFlags && r.qualityFlags.length > 0
                        ? <span className="text-amber-600" title={r.qualityFlags.join(', ')}>⚠ {r.qualityScore ?? '—'}</span>
                        : <span className="text-gray-400">{r.qualityScore ?? '—'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Wired to real data as of 2026-09-07 -- survey/survey_question/
// survey_response/survey_answer via /api/admin/market-research/surveys/overview.
// Create/edit still happens at /admin/surveys (the dedicated question-
// builder page); this dashboard is real read/reporting, not yet a second
// write surface for the same tables.
function RealDataNotice({ count }: { count: number }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
      Live data from <code className="bg-blue-100 px-1 rounded">survey</code>/<code className="bg-blue-100 px-1 rounded">survey_response</code>/<code className="bg-blue-100 px-1 rounded">survey_answer</code> —
      {count === 0 ? ' no surveys exist yet.' : ` ${count} real survey${count === 1 ? '' : 's'}.`} Create/edit questions at <a href="/admin/surveys" className="underline">/admin/surveys</a>.
    </div>
  );
}

const TABS = ["overview", "surveys", "questions", "responses", "analytics", "builder", "response-analysis", "ai-insights", "distribution", "export", "flowchart", "integrations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview:          "Overview",
  surveys:           "Surveys",
  questions:         "Questions",
  responses:         "Responses",
  analytics:         "Analytics",
  builder:           "Survey Builder",
  "response-analysis": "Response Analysis",
  "ai-insights":     "AI Insights",
  distribution:      "Distribution",
  export:            "Export",
  flowchart:         "Flowchart",
  integrations:      "Integrations",
};

const SURVEY_TYPES = ["survey","questionnaire","form","quiz","assessment","poll","nps","feedback"] as const;
const SURVEY_STATUSES = ["draft","active","paused","closed","archived"] as const;
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  closed: "bg-blue-100 text-blue-800",
  archived: "bg-red-100 text-red-700",
};
const TYPE_COLORS: Record<string, string> = {
  survey: "bg-indigo-100 text-indigo-700",
  questionnaire: "bg-purple-100 text-purple-700",
  form: "bg-cyan-100 text-cyan-700",
  quiz: "bg-amber-100 text-amber-700",
  assessment: "bg-orange-100 text-orange-700",
  poll: "bg-pink-100 text-pink-700",
  nps: "bg-teal-100 text-teal-700",
  feedback: "bg-lime-100 text-lime-700",
};

function KpiCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500 bg-blue-50",
    green: "border-green-500 bg-green-50",
    purple: "border-purple-500 bg-purple-50",
    amber: "border-amber-500 bg-amber-50",
    teal: "border-teal-500 bg-teal-50",
    pink: "border-pink-500 bg-pink-50",
  };
  return (
    <div className={`border-l-4 rounded-lg p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>{label}</span>;
}

function OverviewTab({ npsSurveys, overview }: { npsSurveys: NpsSurveySummary[] | null; overview: SurveyOverview | null }) {
  const surveys = overview?.surveys ?? [];
  const responses = overview?.responses ?? [];
  const withResponses = surveys.filter(s => s.responses > 0);
  const totalResponses = responses.length;
  const avgCompletion = withResponses.length ? Math.round(withResponses.reduce((s, sv) => s + sv.completion, 0) / withResponses.length) : 0;
  const activeCount = surveys.filter(s => s.status === "active").length;
  const realNps = npsSurveys?.find(s => s.npsScore !== null) ?? npsSurveys?.[0];

  return (
    <div className="space-y-6">
      <RealDataNotice count={surveys.length} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Surveys" value={surveys.length} sub="All types" color="blue" />
        <KpiCard label="Active" value={activeCount} sub="Live now" color="green" />
        <KpiCard label="Total Responses" value={totalResponses} sub="All surveys" color="purple" />
        <KpiCard label="Avg Completion" value={surveys.length ? `${avgCompletion}%` : "—"} sub="Across surveys with responses" color="teal" />
        <KpiCard
          label="NPS Score" color="amber"
          value={npsSurveys === null ? "…" : realNps?.npsScore !== null && realNps?.npsScore !== undefined ? realNps.npsScore : "—"}
          sub={realNps ? `${realNps.title} (real)` : "No responses yet"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Surveys by Status</h3>
          <div className="space-y-2">
            {SURVEY_STATUSES.map(s => {
              const count = surveys.filter(sv => sv.status === s).length;
              return (
                <div key={s} className="flex items-center justify-between">
                  <Badge label={s} colorClass={STATUS_COLORS[s]} />
                  <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${surveys.length ? (count / surveys.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium w-4">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Surveys by Type</h3>
          <div className="space-y-2">
            {SURVEY_TYPES.map(t => {
              const count = surveys.filter(sv => sv.type === t).length;
              if (count === 0) return null;
              return (
                <div key={t} className="flex items-center justify-between">
                  <Badge label={t} colorClass={TYPE_COLORS[t]} />
                  <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(count / surveys.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-4">{count}</span>
                </div>
              );
            })}
            {surveys.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No surveys yet.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Response Funnel</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: "Started", value: totalResponses, color: "bg-blue-500" },
            { label: "Partial", value: responses.filter(r => r.status === "partial").length, color: "bg-yellow-500" },
            { label: "In Progress", value: responses.filter(r => r.status === "in_progress").length, color: "bg-orange-500" },
            { label: "Submitted", value: responses.filter(r => r.status === "submitted").length, color: "bg-green-500" },
          ].map(f => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <div className={`${f.color} text-white rounded-lg px-3 py-2 w-full text-center`}>
                <div className="text-xl font-bold">{f.value}</div>
                <div className="text-xs">{totalResponses ? Math.round((f.value / totalResponses) * 100) : 0}%</div>
              </div>
              <span className="text-xs text-gray-500">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SurveysTab({ surveys, onChanged }: { surveys: RealSurvey[]; onChanged: () => void }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = surveys.filter(s =>
    (typeFilter === "all" || s.type === typeFilter) &&
    (statusFilter === "all" || s.status === statusFilter)
  );

  // Real status transition -- PATCH /api/admin/market-research/surveys/[id]
  // already enforces the real draft->active->paused/closed->archived state
  // machine; this just calls it instead of leaving Publish/Pause as inert
  // decoration.
  async function setStatus(id: string, status: string) {
    await fetch(`/api/admin/market-research/surveys/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Types</option>
          {SURVEY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          {SURVEY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <a href="/admin/surveys" className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">+ New Survey</a>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Title</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Responses</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Completion</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">NPS</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.title}</td>
                <td className="px-4 py-3"><Badge label={s.type} colorClass={TYPE_COLORS[s.type] || ""} /></td>
                <td className="px-4 py-3"><Badge label={s.status} colorClass={STATUS_COLORS[s.status] || ""} /></td>
                <td className="px-4 py-3 text-right">{s.responses}</td>
                <td className="px-4 py-3 text-right">
                  {s.responses > 0 ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${s.completion}%` }} />
                      </div>
                      <span>{s.completion}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {s.nps !== undefined ? (
                    <span className={`font-bold ${s.nps >= 70 ? "text-green-600" : s.nps >= 30 ? "text-yellow-600" : "text-red-600"}`}>{s.nps}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    {s.status === "draft" && <button onClick={() => setStatus(s.id, 'active')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Publish</button>}
                    {s.status === "active" && <button onClick={() => setStatus(s.id, 'paused')} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pause</button>}
                    {s.status === "paused" && <button onClick={() => setStatus(s.id, 'active')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Resume</button>}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                {surveys.length === 0 ? <>No surveys yet — <a href="/admin/surveys" className="underline">create one</a>.</> : 'No surveys match this filter.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionsTab({ questions, surveys }: { questions: RealQuestion[]; surveys: RealSurvey[] }) {
  const QUESTION_TYPES = ["single_choice","multiple_choice","rating_scale","nps","short_text","long_text","matrix_grid","file_upload","date","email"];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Surveys</option>
          {surveys.map(s => <option key={s.id}>{s.title}</option>)}
        </select>
        <a href="/admin/surveys" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">+ Add Question</a>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Question</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Survey</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Required</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Logic</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {questions.map(q => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{q.order}</td>
                <td className="px-4 py-3 max-w-xs truncate font-medium">{q.text}</td>
                <td className="px-4 py-3"><Badge label={q.type} colorClass="bg-indigo-50 text-indigo-700" /></td>
                <td className="px-4 py-3 text-xs text-gray-500">{q.survey}</td>
                <td className="px-4 py-3 text-center">{q.required ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-center">{q.logic ? <span className="text-blue-500">If/then</span> : "—"}</td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No questions yet — add them from <a href="/admin/surveys" className="underline">/admin/surveys</a>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">Supported Question Types ({QUESTION_TYPES.length})</p>
        <div className="flex flex-wrap gap-2">
          {QUESTION_TYPES.map(t => <Badge key={t} label={t} colorClass="bg-blue-100 text-blue-700" />)}
        </div>
      </div>
    </div>
  );
}

function ResponsesTab({ responses, surveys }: { responses: RealResponse[]; surveys: RealSurvey[] }) {
  const statusColors: Record<string, string> = {
    submitted: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
  };

  // Real client-side CSV export of exactly the rows on screen -- no
  // fabricated SPSS .sav export (that's a real binary format this
  // codebase has no writer for; the button is removed rather than faked).
  function exportCsv() {
    const header = ['Survey', 'Respondent', 'Status', 'Completion %', 'Duration', 'Submitted'];
    const lines = [header.join(',')].concat(
      responses.map(r => [r.survey, r.respondent, r.status, String(r.completion), r.duration, r.submittedAt]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'survey-responses.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Surveys</option>
          {surveys.map(s => <option key={s.id}>{s.title}</option>)}
        </select>
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Statuses</option>
          <option>submitted</option><option>partial</option><option>in_progress</option>
        </select>
        <button onClick={exportCsv} disabled={!responses.length} className="ml-auto border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">Export CSV</button>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Survey</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Respondent</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Completion</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Duration</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {responses.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs truncate">{r.survey}</td>
                <td className="px-4 py-3 text-gray-500">{r.respondent}</td>
                <td className="px-4 py-3"><Badge label={r.status} colorClass={statusColors[r.status] || ""} /></td>
                <td className="px-4 py-3 text-right">{r.completion}%</td>
                <td className="px-4 py-3 text-right">{r.duration}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{r.submittedAt}</td>
              </tr>
            ))}
            {responses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No responses submitted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab({ npsSurveys, overview }: { npsSurveys: NpsSurveySummary[] | null; overview: SurveyOverview | null }) {
  const realNps = npsSurveys?.find(s => s.npsScore !== null) ?? npsSurveys?.[0];
  const npsQ = realNps?.questions.find(q => q.type === 'nps');
  const textQ = realNps?.questions.find(q => q.type === 'long_text');
  const npsTotal = (npsQ?.promoters ?? 0) + (npsQ?.passives ?? 0) + (npsQ?.detractors ?? 0);
  const pct = (n: number | undefined) => npsTotal && n !== undefined ? Math.round((n / npsTotal) * 100) : 0;
  const surveys = overview?.surveys ?? [];
  const answerDistribution = overview?.answerDistribution ?? [];
  const completionBuckets = overview?.completionBuckets ?? [];
  const maxAnswerCount = Math.max(1, ...answerDistribution.map(a => a.count));
  const totalBucketed = completionBuckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-6">
      <NpsRecordsSection />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">NPS Overview — {realNps?.title ?? 'Post-Class Experience'} (real)</h3>
          {!npsSurveys ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : !realNps || realNps.npsScore === null ? (
            <p className="text-sm text-gray-400 text-center py-6">No responses yet — real score will appear once customers submit feedback.</p>
          ) : (
            <>
              <div className="text-center">
                <div className="text-5xl font-bold text-teal-600">{realNps.npsScore}</div>
                <div className="text-sm text-gray-500 mt-1">Net Promoter Score</div>
                <Badge label={realNps.category} colorClass="bg-teal-100 text-teal-700 mt-2" />
              </div>
              <div className="mt-4 grid grid-cols-3 text-center text-sm border-t pt-3">
                <div><div className="font-bold text-green-600">{pct(npsQ?.promoters)}%</div><div className="text-gray-400">Promoters</div></div>
                <div><div className="font-bold text-yellow-600">{pct(npsQ?.passives)}%</div><div className="text-gray-400">Passives</div></div>
                <div><div className="font-bold text-red-600">{pct(npsQ?.detractors)}%</div><div className="text-gray-400">Detractors</div></div>
              </div>
              {textQ?.sentimentCounts && (
                <div className="mt-4 border-t pt-3 text-xs text-gray-500">
                  <p className="font-medium text-gray-700 mb-1">Free-text sentiment ({textQ.totalAnswers} responses)</p>
                  <p>Positive {textQ.sentimentCounts.positive} · Neutral {textQ.sentimentCounts.neutral} · Negative {textQ.sentimentCounts.negative}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Completion Rates</h3>
          <div className="space-y-3">
            {surveys.filter(s => s.responses > 0).map(s => (
              <div key={s.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate max-w-32">{s.title}</span>
                  <span className="font-medium">{s.completion}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${s.completion}%` }} />
                </div>
              </div>
            ))}
            {surveys.filter(s => s.responses > 0).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No surveys with responses yet.</p>}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Top Answers — All Choice Questions</h3>
          <div className="space-y-2 text-sm">
            {answerDistribution.map(o => (
              <div key={o.option} className="flex items-center gap-2">
                <span className="w-36 text-xs truncate">{o.option}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(o.count / maxAnswerCount) * 100}%` }} />
                </div>
                <span className="text-xs w-8 text-right">{o.count}</span>
              </div>
            ))}
            {answerDistribution.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No choice-question answers submitted yet.</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Response Completion Distribution</h3>
        <p className="text-xs text-gray-400 mb-3">
          Real bucketed histogram of survey_response.completion_percent — this codebase tracks completion at the
          response level only, not per-question abandonment, so a per-question drop-off funnel isn&apos;t available yet.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {["0-24%","25-49%","50-74%","75-99%","100%"].map(bucket => {
            const count = completionBuckets.find(b => b.bucket === bucket)?.count ?? 0;
            const heightPct = totalBucketed ? Math.round((count / totalBucketed) * 100) : 0;
            return (
              <div key={bucket} className="flex flex-col items-center gap-2">
                <div className="w-full bg-gray-200 rounded relative" style={{ height: "80px" }}>
                  <div className="absolute bottom-0 w-full bg-blue-500 rounded" style={{ height: `${heightPct}%` }} />
                </div>
                <span className="text-xs text-gray-500">{bucket}</span>
                <span className="text-xs font-medium">{count}</span>
              </div>
            );
          })}
        </div>
        {totalBucketed === 0 && <p className="text-sm text-gray-400 text-center py-2">No responses yet.</p>}
      </div>
    </div>
  );
}

function FlowchartTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Survey Lifecycle State Machine</h3>
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max text-sm">
            {[
              { state: "draft", color: "bg-gray-200 text-gray-700" },
              { arrow: "publish()" },
              { state: "active", color: "bg-green-200 text-green-800" },
              { arrow: "pause()" },
              { state: "paused", color: "bg-yellow-200 text-yellow-800" },
            ].map((n, i) => (
              "state" in n ? (
                <div key={i} className={`px-4 py-2 rounded-lg font-medium border-2 border-white shadow ${n.color}`}>{n.state}</div>
              ) : (
                <div key={i} className="flex items-center gap-1 text-gray-400">
                  <span className="text-xs">{n.arrow}</span>
                  <span>→</span>
                </div>
              )
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-400 flex gap-4">
            <span>resume() → active</span>
            <span>close() → closed → archive() → archived (terminal)</span>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">12-Step Response Submission Flow</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { step: 1, title: "Open survey link", desc: "Public or invite token" },
            { step: 2, title: "Check isActive(now)", desc: "404 if expired or unpublished" },
            { step: 3, title: "Check response limit", desc: "Block if maxed" },
            { step: 4, title: "Check duplicates", desc: "allowMultipleResponses gate" },
            { step: 5, title: "Create SurveyResponse", desc: "status = in_progress" },
            { step: 6, title: "Serve questions", desc: "With conditional logic applied" },
            { step: 7, title: "addAnswer() per Q", desc: "Live save on each answer" },
            { step: 8, title: "updateCompletion(%)", desc: "Progress bar updated" },
            { step: 9, title: "saveAndResume", desc: "Persist partial if abandoned" },
            { step: 10, title: "submit_response MCP", desc: "confirmText=SUBMIT_RESPONSE" },
            { step: 11, title: "submit(at)", desc: "status=submitted, pct=100" },
            { step: 12, title: "recordResponse(true)", desc: "Survey counts updated" },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{s.step}</div>
              <div>
                <div className="font-medium text-sm">{s.title}</div>
                <div className="text-xs text-gray-400">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4">NPS Category Thresholds</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { range: "70–100", label: "Excellent", color: "bg-teal-500 text-white" },
            { range: "30–69", label: "Good", color: "bg-green-500 text-white" },
            { range: "0–29", label: "Needs Improvement", color: "bg-yellow-500 text-white" },
            { range: "-100–-1", label: "Critical", color: "bg-red-500 text-white" },
          ].map(c => (
            <div key={c.range} className={`${c.color} rounded-lg p-4 text-center`}>
              <div className="text-lg font-bold">{c.range}</div>
              <div className="text-sm mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const DB_TABLES = [
    { name: "survey", desc: "Master record + settings" },
    { name: "survey_question", desc: "Questions with type & constraints" },
    { name: "survey_question_option", desc: "Choice options + matrix columns/rows" },
    { name: "survey_question_logic", desc: "Conditional show/skip rules" },
    { name: "survey_response", desc: "Per-respondent response session" },
    { name: "survey_answer", desc: "Individual answers within a response" },
    { name: "survey_analytics", desc: "Aggregated survey-level stats" },
    { name: "survey_question_summary", desc: "Per-question aggregated stats" },
    { name: "survey_invitation", desc: "Email invitation tracking" },
    { name: "survey_export", desc: "CSV/Excel/SPSS export records" },
    { name: "survey_audit", desc: "Full audit trail" },
    { name: "survey_notification", desc: "Novu notification log" },
  ];

  const MCP_TOOLS = [
    { name: "list_surveys", tier: "auto" },
    { name: "get_survey", tier: "auto" },
    { name: "get_analytics", tier: "staff" },
    { name: "create_survey", tier: "staff" },
    { name: "add_question", tier: "staff" },
    { name: "send_invitation", tier: "staff" },
    { name: "get_responses", tier: "staff" },
    { name: "export_responses", tier: "staff" },
    { name: "submit_response", tier: "customer_confirm" },
    { name: "publish_survey", tier: "staff_approval" },
    { name: "close_survey", tier: "staff_approval" },
    { name: "delete_survey", tier: "admin_destructive" },
  ];

  const TIER_COLORS: Record<string, string> = {
    auto: "bg-green-100 text-green-700",
    staff: "bg-blue-100 text-blue-700",
    customer_confirm: "bg-yellow-100 text-yellow-700",
    staff_approval: "bg-orange-100 text-orange-700",
    admin_destructive: "bg-red-100 text-red-700",
  };

  const EXTERNAL_SYSTEMS = [
    { name: "Novu", role: "Invitations, confirmations, export-ready alerts" },
    { name: "PostHog", role: "Response events, drop-off funnels, NPS trends" },
    { name: "Formbricks", role: "Open-source survey engine (clone wave 11)" },
    { name: "LimeSurvey", role: "IRB/research questionnaire baseline (import)" },
    { name: "SurveyJS", role: "JSON-based question renderer for front-end" },
    { name: "MinIO/S3", role: "File upload + digital signature storage" },
    { name: "Keycloak", role: "respondentId resolution; invite_only auth" },
    { name: "n8n", role: "Post-submission workflow automation" },
  ];

  const CROSS_WAVE = [
    { wave: 1, module: "Teacher", integration: "Teacher evaluation surveys; IRB questionnaires" },
    { wave: 2, module: "Scheduling", integration: "Post-class feedback (automated trigger)" },
    { wave: 3, module: "Membership", integration: "Onboarding questionnaire, renewal NPS" },
    { wave: 4, module: "Wellness", integration: "Health assessment forms (SOAP, PRO)" },
    { wave: 9, module: "Referral", integration: "Referrer satisfaction NPS" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Database Tables (12)</h3>
          <div className="space-y-1.5">
            {DB_TABLES.map(t => (
              <div key={t.name} className="flex items-start gap-2">
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-blue-700 whitespace-nowrap">{t.name}</code>
                <span className="text-xs text-gray-500">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">MCP Tools (12)</h3>
          <div className="space-y-1.5">
            {MCP_TOOLS.map(t => (
              <div key={t.name} className="flex items-center justify-between">
                <code className="text-xs font-mono text-gray-700">{t.name}</code>
                <Badge label={t.tier} colorClass={TIER_COLORS[t.tier] || ""} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">External Systems (8)</h3>
          <div className="space-y-2">
            {EXTERNAL_SYSTEMS.map(s => (
              <div key={s.name} className="flex items-start gap-2 text-sm">
                <span className="font-medium text-blue-700 w-28 flex-shrink-0">{s.name}</span>
                <span className="text-gray-500">{s.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Cross-Wave Integration</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="pb-2 text-left">Wave</th>
                <th className="pb-2 text-left">Module</th>
                <th className="pb-2 text-left">Integration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {CROSS_WAVE.map(c => (
                <tr key={c.wave} className="text-xs">
                  <td className="py-2 text-gray-400">W{c.wave}</td>
                  <td className="py-2 font-medium">{c.module}</td>
                  <td className="py-2 text-gray-500">{c.integration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Survey Builder Tab ────────────────────────────────────────────────────────
type QuestionType = 'text' | 'number' | 'radio' | 'checkbox' | 'rating' | 'nps' | 'matrix' | 'date' | 'file';

interface BuilderQuestion {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  required: boolean;
  logicRule: string;
}

function SurveyBuilderTab({ surveys }: { surveys: RealSurvey[] }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(surveys[0]?.id ?? "");
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
    { value: 'text', label: 'Short Text' },
    { value: 'number', label: 'Number' },
    { value: 'radio', label: 'Single Choice' },
    { value: 'checkbox', label: 'Multi Choice' },
    { value: 'rating', label: 'Rating (1-5)' },
    { value: 'nps', label: 'NPS (0-10)' },
    { value: 'matrix', label: 'Matrix Grid' },
    { value: 'date', label: 'Date' },
    { value: 'file', label: 'File Upload' },
  ];

  function addQuestion() {
    setQuestions(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'text',
      text: '',
      options: ['Option A', 'Option B'],
      required: true,
      logicRule: '',
    }]);
  }

  function updateQuestion(id: string, patch: Partial<BuilderQuestion>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id));
  }

  function moveQuestion(id: string, dir: 'up' | 'down') {
    setQuestions(prev => {
      const idx = prev.findIndex(q => q.id === id);
      if (idx < 0) return prev;
      const newArr = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newArr.length) return prev;
      [newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]];
      return newArr;
    });
  }

  async function saveAll() {
    if (!selectedSurveyId || questions.length === 0) return;
    setSaving(true);
    setSaveMsg("");
    let saved = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const res = await fetch(`/api/admin/surveys/${selectedSurveyId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: q.text || 'Untitled question',
          question_type: q.type,
          options: q.options.map((o, idx) => ({ label: o, value: String(idx) })),
          required: q.required,
          sort_order: i,
          logic_rules: q.logicRule ? { raw: q.logicRule } : {},
        }),
      });
      if (res.ok) saved++;
    }
    setSaving(false);
    setSaveMsg(`Saved ${saved}/${questions.length} questions.`);
    setQuestions([]);
  }

  const needsOptions = (t: QuestionType) => t === 'radio' || t === 'checkbox' || t === 'matrix';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={selectedSurveyId} onChange={e => setSelectedSurveyId(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">Select survey…</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <button onClick={addQuestion} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">+ Add Question</button>
        <button onClick={saveAll} disabled={saving || questions.length === 0 || !selectedSurveyId} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40">
          {saving ? 'Saving…' : 'Save All Questions'}
        </button>
        {saveMsg && <span className="text-sm text-green-700 font-medium">{saveMsg}</span>}
      </div>

      {questions.length === 0 && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm">Click &ldquo;+ Add Question&rdquo; to start building your survey</p>
          <p className="text-xs text-gray-400 mt-1">Supports 9 question types including NPS, rating, matrix, and file upload</p>
        </div>
      )}

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm font-medium w-6">{idx + 1}.</span>
              <input
                className="flex-1 border rounded px-3 py-1.5 text-sm"
                placeholder="Question text…"
                value={q.text}
                onChange={e => updateQuestion(q.id, { text: e.target.value })}
              />
              <select value={q.type} onChange={e => updateQuestion(q.id, { type: e.target.value as QuestionType })} className="border rounded px-2 py-1.5 text-sm">
                {QUESTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} />
                Required
              </label>
              <button onClick={() => moveQuestion(q.id, 'up')} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 text-xs px-1 disabled:opacity-30">↑</button>
              <button onClick={() => moveQuestion(q.id, 'down')} disabled={idx === questions.length - 1} className="text-gray-400 hover:text-gray-700 text-xs px-1 disabled:opacity-30">↓</button>
              <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
            </div>

            {needsOptions(q.type) && (
              <div className="ml-8 space-y-1">
                <p className="text-xs text-gray-500 font-medium">Options:</p>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex gap-2">
                    <input
                      className="border rounded px-2 py-1 text-sm flex-1"
                      value={opt}
                      onChange={e => {
                        const opts = [...q.options]; opts[oi] = e.target.value;
                        updateQuestion(q.id, { options: opts });
                      }}
                    />
                    <button onClick={() => { const opts = q.options.filter((_, i) => i !== oi); updateQuestion(q.id, { options: opts }); }} className="text-red-400 text-xs">✕</button>
                  </div>
                ))}
                <button onClick={() => updateQuestion(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })} className="text-blue-500 text-xs">+ Add option</button>
              </div>
            )}

            <div className="ml-8">
              <input
                className="w-full border rounded px-2 py-1 text-xs text-gray-500"
                placeholder="Conditional logic (e.g. Show if Q1 = Promoter)"
                value={q.logicRule}
                onChange={e => updateQuestion(q.id, { logicRule: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Response Analysis Tab ─────────────────────────────────────────────────────
function ResponseAnalysisTab({ surveys }: { surveys: RealSurvey[] }) {
  const [surveyId, setSurveyId] = useState<string>(surveys[0]?.id ?? "");
  const [data, setData] = useState<{
    stats: { total: number; complete: number; completionRate: number };
    responses: Array<{ id: number; respondent_email: string; is_complete: boolean; completion_time_seconds: number; started_at: string; completed_at: string; answer_count: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/surveys/${id}/responses`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(id: string) {
    setSurveyId(id);
    load(id);
  }

  const survey = surveys.find(s => s.id === surveyId);
  const avgTime = data?.responses.length
    ? Math.round(data.responses.filter(r => r.completion_time_seconds).reduce((s, r) => s + (r.completion_time_seconds || 0), 0) / data.responses.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={surveyId} onChange={e => handleSelect(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">Select survey…</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <button onClick={() => load(surveyId)} disabled={loading || !surveyId} className="border px-3 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-40">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Total Responses" value={data.stats.total} color="blue" />
            <KpiCard label="Completion Rate" value={`${data.stats.completionRate}%`} color="green" />
            <KpiCard label="Avg Time" value={avgTime ? `${avgTime}s` : '—'} sub="completion time" color="amber" />
          </div>

          {survey && survey.nps !== undefined && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">NPS Score</h3>
              <div className="text-center">
                <div className={`text-5xl font-bold ${survey.nps >= 50 ? 'text-green-600' : survey.nps >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {survey.nps}
                </div>
                <p className="text-sm text-gray-500 mt-1">Net Promoter Score</p>
                <Badge label={survey.nps >= 70 ? 'Excellent' : survey.nps >= 30 ? 'Good' : 'Needs Work'} colorClass={survey.nps >= 70 ? 'bg-green-100 text-green-700' : survey.nps >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'} />
              </div>
            </div>
          )}

          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-800 text-sm">Individual Responses ({data.responses.length})</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['#', 'Respondent', 'Complete', 'Answers', 'Time', 'Started'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.responses.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{r.id}</td>
                    <td className="px-4 py-2 text-xs">{r.respondent_email || '—'}</td>
                    <td className="px-4 py-2"><Badge label={r.is_complete ? 'Yes' : 'No'} colorClass={r.is_complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} /></td>
                    <td className="px-4 py-2 text-xs text-center">{r.answer_count}</td>
                    <td className="px-4 py-2 text-xs">{r.completion_time_seconds ? `${r.completion_time_seconds}s` : '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{new Date(r.started_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {data.responses.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No responses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && <p className="text-sm text-gray-400 text-center py-8">Select a survey to view response analysis.</p>}
    </div>
  );
}

// ─── AI Insights Tab ───────────────────────────────────────────────────────────
function AiInsightsTab({ surveys }: { surveys: RealSurvey[] }) {
  const [surveyId, setSurveyId] = useState<string>(surveys[0]?.id ?? "");
  const [analysis, setAnalysis] = useState<{ analysis: string; responseCount: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!surveyId) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/admin/surveys/${surveyId}/analyze`, { method: 'POST' });
      if (res.ok) setAnalysis(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-semibold text-purple-800 mb-1">AI-Powered Response Analysis</h3>
        <p className="text-xs text-purple-600">Ollama llama3.2 analyzes all text responses and generates themes, sentiment, and recommendations — fully local, no cloud AI.</p>
      </div>

      <div className="flex gap-3 items-center">
        <select value={surveyId} onChange={e => setSurveyId(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">Select survey…</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <button onClick={analyze} disabled={loading || !surveyId} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-40">
          {loading ? 'Analyzing with Ollama…' : '🤖 Run AI Analysis'}
        </button>
      </div>

      {loading && (
        <div className="bg-white border rounded-lg p-8 text-center">
          <div className="text-purple-500 text-2xl mb-2">🤖</div>
          <p className="text-sm text-gray-500">Ollama is analyzing responses…</p>
          <p className="text-xs text-gray-400 mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-500">🤖</span>
              <h3 className="font-semibold text-gray-800">AI Analysis</h3>
              <Badge label={`${analysis.responseCount} responses analyzed`} colorClass="bg-purple-100 text-purple-700" />
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
              {analysis.analysis}
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
            AI analysis is for informational purposes only. Review outputs before acting on recommendations.
          </div>
        </div>
      )}

      {!loading && !analysis && <p className="text-sm text-gray-400 text-center py-8">Select a survey and click &ldquo;Run AI Analysis&rdquo; to generate insights.</p>}
    </div>
  );
}

// ─── Distribution Tab ──────────────────────────────────────────────────────────
function DistributionTab({ surveys }: { surveys: RealSurvey[] }) {
  const [surveyId, setSurveyId] = useState<string>(surveys[0]?.id ?? "");
  const [emails, setEmails] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const embedCode = surveyId ? `<iframe src="${origin}/survey/${surveyId}" width="100%" height="600" frameborder="0" title="Survey"></iframe>` : '';
  const directLink = surveyId ? `${origin}/survey/${surveyId}` : '';

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={surveyId} onChange={e => setSurveyId(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">Select survey…</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Direct Link</h3>
          <div className="flex gap-2">
            <input readOnly value={directLink} className="flex-1 border rounded px-3 py-2 text-sm bg-gray-50 font-mono text-xs" />
            <button onClick={() => copyToClipboard(directLink)} className="bg-blue-600 text-white px-3 py-2 rounded text-sm">
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <div className="text-4xl mb-2">📱</div>
            <p className="text-xs text-gray-500">QR Code — scan to open survey</p>
            <p className="text-xs text-gray-400 mt-1">QR generation requires qrcode library</p>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Embed Code</h3>
          <textarea
            readOnly
            value={embedCode}
            rows={4}
            className="w-full border rounded px-3 py-2 text-xs font-mono bg-gray-50"
          />
          <button onClick={() => copyToClipboard(embedCode)} className="border px-3 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-50">Copy Embed Code</button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-gray-800">Email Distribution</h3>
        <p className="text-xs text-gray-500">Paste email addresses (one per line or comma-separated) to create a scheduled broadcast</p>
        <textarea
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="alice@example.com&#10;bob@example.com&#10;carol@example.com"
          value={emails}
          onChange={e => setEmails(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            disabled={!emails.trim() || !surveyId}
            onClick={() => alert(`Broadcast to ${emails.split(/[\n,]+/).filter(Boolean).length} recipients would be scheduled. Connect /api/admin/broadcast to enable sending.`)}
          >
            Schedule Email Broadcast
          </button>
          <span className="text-xs text-gray-400 self-center">
            {emails.split(/[\n,]+/).filter(e => e.trim()).length} recipients
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Export Tab ────────────────────────────────────────────────────────────────
function ExportTab({ surveys }: { surveys: RealSurvey[] }) {
  const [surveyId, setSurveyId] = useState<string>(surveys[0]?.id ?? "");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  async function seedData() {
    setSeeding(true);
    setSeedMsg("");
    const res = await fetch('/api/admin/surveys/seed', { method: 'POST' });
    const d = await res.json() as { ok?: boolean; message?: string; error?: string };
    setSeedMsg(d.message ?? d.error ?? 'Done');
    setSeeding(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <select value={surveyId} onChange={e => setSurveyId(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">Select survey…</option>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Export Responses</h3>
          <p className="text-sm text-gray-500">Download all responses with answers as a CSV file.</p>
          <a
            href={surveyId ? `/api/admin/surveys/${surveyId}/export` : '#'}
            className={`inline-block bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 ${!surveyId ? 'pointer-events-none opacity-40' : ''}`}
          >
            ↓ Download Responses CSV
          </a>
        </div>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-gray-800">Seed Demo Data</h3>
          <p className="text-sm text-gray-500">Create 2 survey templates (NPS + CSAT) with 10 demo responses for testing.</p>
          <button onClick={seedData} disabled={seeding} className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-40">
            {seeding ? 'Seeding…' : 'Seed Survey Templates'}
          </button>
          {seedMsg && <p className="text-xs text-gray-600">{seedMsg}</p>}
        </div>
      </div>
    </div>
  );
}

export default function SurveyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const npsSurveys = useNpsSummary();
  const { data: overview, reload: reloadOverview } = useSurveyOverview();

  const TAB_CONTENT: Record<Tab, React.ReactElement> = {
    overview:            <OverviewTab npsSurveys={npsSurveys} overview={overview} />,
    surveys:             <SurveysTab surveys={overview?.surveys ?? []} onChanged={reloadOverview} />,
    questions:           <QuestionsTab questions={overview?.questions ?? []} surveys={overview?.surveys ?? []} />,
    responses:           <ResponsesTab responses={overview?.responses ?? []} surveys={overview?.surveys ?? []} />,
    analytics:           <AnalyticsTab npsSurveys={npsSurveys} overview={overview} />,
    builder:             <SurveyBuilderTab surveys={overview?.surveys ?? []} />,
    "response-analysis": <ResponseAnalysisTab surveys={overview?.surveys ?? []} />,
    "ai-insights":       <AiInsightsTab surveys={overview?.surveys ?? []} />,
    distribution:        <DistributionTab surveys={overview?.surveys ?? []} />,
    export:              <ExportTab surveys={overview?.surveys ?? []} />,
    flowchart:           <FlowchartTab />,
    integrations:        <IntegrationsTab />,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Survey Management</h1>
            <p className="text-sm text-gray-500 mt-1">Surveys · Questionnaires · Forms · Polls · NPS · Feedback</p>
          </div>
          <div className="flex gap-2">
            <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">Wave 11</span>
            <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">DDD + TDD</span>
          </div>
        </div>

        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div>{TAB_CONTENT[activeTab]}</div>
      </div>
    </div>
  );
}
