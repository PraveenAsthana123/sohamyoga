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
interface NpsResponseRecord { id: string; respondent: string; status: string; submittedAt?: string; npsScore?: number }

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
                <tr>{['Respondent', 'Score', 'Status', 'Submitted'].map(h => <th key={h} className="px-4 py-2 text-left font-medium text-gray-600">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {data.responses.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">{r.respondent}</td>
                    <td className="px-4 py-2 font-bold">{r.npsScore ?? '—'}</td>
                    <td className="px-4 py-2"><Badge label={r.status} colorClass={NPS_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
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

// Real, live-computed NPS data (from NpsCalculationJob via /api/survey/nps-summary).
// Everything else on this page — MOCK_SURVEYS, MOCK_RESPONSES, the Questions/
// Responses tabs, and most of the Analytics tab — remains illustrative UI
// mockup pending a full survey-platform build (create/edit/publish surveys,
// question builder, response viewer, exports); only the post-class-experience
// NPS pipeline built this session is wired to real data. Flagged rather than
// silently left to look more complete than it is.
function MockDataNotice() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
      This page mostly shows illustrative sample data — only the <strong>NPS Score</strong> cards below
      are wired to the real, live post-class feedback pipeline. Survey/question/response management
      here is a UI mockup, not yet backed by a working create/edit/respond flow beyond that one survey.
    </div>
  );
}

const TABS = ["overview", "surveys", "questions", "responses", "analytics", "flowchart", "integrations"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  overview:     "Overview",
  surveys:      "Surveys",
  questions:    "Questions",
  responses:    "Responses",
  analytics:    "Analytics",
  flowchart:    "Flowchart",
  integrations: "Integrations",
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

const MOCK_SURVEYS = [
  { id:"sv-1", title:"Post-Class Yoga Feedback", type:"feedback", status:"active", responses:142, completion:88, nps: undefined },
  { id:"sv-2", title:"New Member Health Intake", type:"form", status:"active", responses:67, completion:95, nps: undefined },
  { id:"sv-3", title:"Teacher Satisfaction NPS", type:"nps", status:"active", responses:210, completion:91, nps:72 },
  { id:"sv-4", title:"Class Schedule Preference Poll", type:"poll", status:"closed", responses:89, completion:100, nps: undefined },
  { id:"sv-5", title:"IRB Research Questionnaire", type:"questionnaire", status:"paused", responses:28, completion:75, nps: undefined },
  { id:"sv-6", title:"Yoga Knowledge Quiz", type:"quiz", status:"draft", responses:0, completion:0, nps: undefined },
];

const MOCK_RESPONSES = [
  { id:"r-1", survey:"Post-Class Yoga Feedback", respondent:"Anonymous", status:"submitted", completion:100, duration:"4m 12s", submittedAt:"2026-08-04 18:32" },
  { id:"r-2", survey:"New Member Health Intake", respondent:"priya@yoga.in", status:"submitted", completion:100, duration:"7m 55s", submittedAt:"2026-08-04 11:10" },
  { id:"r-3", survey:"Teacher Satisfaction NPS", respondent:"Anonymous", status:"submitted", completion:100, duration:"1m 30s", submittedAt:"2026-08-04 09:45" },
  { id:"r-4", survey:"IRB Research Questionnaire", respondent:"P-042", status:"partial", completion:60, duration:"12m 00s", submittedAt:"—" },
  { id:"r-5", survey:"Post-Class Yoga Feedback", respondent:"Anonymous", status:"in_progress", completion:30, duration:"—", submittedAt:"—" },
];

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

function OverviewTab({ npsSurveys }: { npsSurveys: NpsSurveySummary[] | null }) {
  const totalResponses = MOCK_SURVEYS.reduce((s, sv) => s + sv.responses, 0);
  const avgCompletion = Math.round(MOCK_SURVEYS.filter(s => s.responses > 0).reduce((s, sv) => s + sv.completion, 0) / MOCK_SURVEYS.filter(s => s.responses > 0).length);
  const activeCount = MOCK_SURVEYS.filter(s => s.status === "active").length;
  const realNps = npsSurveys?.find(s => s.npsScore !== null) ?? npsSurveys?.[0];

  return (
    <div className="space-y-6">
      <MockDataNotice />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Surveys" value={MOCK_SURVEYS.length} sub="All types (sample)" color="blue" />
        <KpiCard label="Active" value={activeCount} sub="Live now (sample)" color="green" />
        <KpiCard label="Total Responses" value={totalResponses} sub="All surveys (sample)" color="purple" />
        <KpiCard label="Avg Completion" value={`${avgCompletion}%`} sub="Submitted (sample)" color="teal" />
        <KpiCard
          label="NPS Score" color="amber"
          value={npsSurveys === null ? "…" : realNps?.npsScore !== null && realNps?.npsScore !== undefined ? realNps.npsScore : "—"}
          sub={realNps ? `${realNps.title} (real)` : "No responses yet"}
        />
        <KpiCard label="Avg Duration" value="4.8 min" sub="Per response (sample)" color="pink" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Surveys by Status</h3>
          <div className="space-y-2">
            {SURVEY_STATUSES.map(s => {
              const count = MOCK_SURVEYS.filter(sv => sv.status === s).length;
              return (
                <div key={s} className="flex items-center justify-between">
                  <Badge label={s} colorClass={STATUS_COLORS[s]} />
                  <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(count / MOCK_SURVEYS.length) * 100}%` }} />
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
              const count = MOCK_SURVEYS.filter(sv => sv.type === t).length;
              if (count === 0) return null;
              return (
                <div key={t} className="flex items-center justify-between">
                  <Badge label={t} colorClass={TYPE_COLORS[t]} />
                  <div className="flex-1 mx-3 bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(count / MOCK_SURVEYS.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-4">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Response Funnel</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: "Started", value: totalResponses, pct: 100, color: "bg-blue-500" },
            { label: "Partial", value: MOCK_RESPONSES.filter(r => r.status === "partial").length, pct: 15, color: "bg-yellow-500" },
            { label: "In Progress", value: MOCK_RESPONSES.filter(r => r.status === "in_progress").length, pct: 8, color: "bg-orange-500" },
            { label: "Submitted", value: MOCK_RESPONSES.filter(r => r.status === "submitted").length, pct: 77, color: "bg-green-500" },
          ].map(f => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <div className={`${f.color} text-white rounded-lg px-3 py-2 w-full text-center`}>
                <div className="text-xl font-bold">{f.value}</div>
                <div className="text-xs">{f.pct}%</div>
              </div>
              <span className="text-xs text-gray-500">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SurveysTab() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = MOCK_SURVEYS.filter(s =>
    (typeFilter === "all" || s.type === typeFilter) &&
    (statusFilter === "all" || s.status === statusFilter)
  );

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
        <button className="ml-auto bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">+ New Survey</button>
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
                    <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">View</button>
                    <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Edit</button>
                    {s.status === "draft" && <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Publish</button>}
                    {s.status === "active" && <button className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Pause</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuestionsTab() {
  const QUESTION_TYPES = ["single_choice","multiple_choice","rating_scale","nps","short_text","long_text","matrix_grid","file_upload","date","email"];
  const MOCK_QUESTIONS = [
    { id:"q-1", survey:"Post-Class Yoga Feedback", type:"rating_scale", text:"How would you rate today's class?", required:true, order:1, logic:false },
    { id:"q-2", survey:"Post-Class Yoga Feedback", type:"short_text", text:"What did you enjoy most?", required:false, order:2, logic:false },
    { id:"q-3", survey:"Post-Class Yoga Feedback", type:"nps", text:"How likely to recommend us to a friend?", required:true, order:3, logic:false },
    { id:"q-4", survey:"New Member Health Intake", type:"single_choice", text:"Do you have any existing medical conditions?", required:true, order:1, logic:false },
    { id:"q-5", survey:"New Member Health Intake", type:"long_text", text:"Please describe your conditions", required:false, order:2, logic:true },
    { id:"q-6", survey:"IRB Research Questionnaire", type:"matrix_grid", text:"Rate frequency of seizure triggers", required:true, order:1, logic:false },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Surveys</option>
          {MOCK_SURVEYS.map(s => <option key={s.id}>{s.title}</option>)}
        </select>
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">+ Add Question</button>
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
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_QUESTIONS.map(q => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{q.order}</td>
                <td className="px-4 py-3 max-w-xs truncate font-medium">{q.text}</td>
                <td className="px-4 py-3"><Badge label={q.type} colorClass="bg-indigo-50 text-indigo-700" /></td>
                <td className="px-4 py-3 text-xs text-gray-500">{q.survey}</td>
                <td className="px-4 py-3 text-center">{q.required ? "✓" : "—"}</td>
                <td className="px-4 py-3 text-center">{q.logic ? <span className="text-blue-500">If/then</span> : "—"}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-1 justify-center">
                    <button className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Edit</button>
                    <button className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
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

function ResponsesTab() {
  const statusColors: Record<string, string> = {
    submitted: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    in_progress: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Surveys</option>
          {MOCK_SURVEYS.map(s => <option key={s.id}>{s.title}</option>)}
        </select>
        <select className="border rounded px-3 py-2 text-sm">
          <option>All Statuses</option>
          <option>submitted</option><option>partial</option><option>in_progress</option>
        </select>
        <button className="ml-auto border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Export CSV</button>
        <button className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">Export SPSS</button>
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
              <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_RESPONSES.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs truncate">{r.survey}</td>
                <td className="px-4 py-3 text-gray-500">{r.respondent}</td>
                <td className="px-4 py-3"><Badge label={r.status} colorClass={statusColors[r.status] || ""} /></td>
                <td className="px-4 py-3 text-right">{r.completion}%</td>
                <td className="px-4 py-3 text-right">{r.duration}</td>
                <td className="px-4 py-3 text-right text-xs text-gray-500">{r.submittedAt}</td>
                <td className="px-4 py-3 text-center">
                  <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab({ npsSurveys }: { npsSurveys: NpsSurveySummary[] | null }) {
  const realNps = npsSurveys?.find(s => s.npsScore !== null) ?? npsSurveys?.[0];
  const npsQ = realNps?.questions.find(q => q.type === 'nps');
  const textQ = realNps?.questions.find(q => q.type === 'long_text');
  const npsTotal = (npsQ?.promoters ?? 0) + (npsQ?.passives ?? 0) + (npsQ?.detractors ?? 0);
  const pct = (n: number | undefined) => npsTotal && n !== undefined ? Math.round((n / npsTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <MockDataNotice />
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
            {MOCK_SURVEYS.filter(s => s.responses > 0).map(s => (
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
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Top Answers — Class Feedback</h3>
          <div className="space-y-2 text-sm">
            {[
              { option: "Morning Pranayama", count: 45, pct: 45 },
              { option: "Hatha Asanas", count: 32, pct: 32 },
              { option: "Meditation", count: 18, pct: 18 },
              { option: "Chanting", count: 5, pct: 5 },
            ].map(o => (
              <div key={o.option} className="flex items-center gap-2">
                <span className="w-36 text-xs truncate">{o.option}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${o.pct}%` }} />
                </div>
                <span className="text-xs w-8 text-right">{o.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Drop-off Analysis</h3>
        <div className="grid grid-cols-5 gap-2">
          {["Started","Q1","Q2","Q3","Submitted"].map((step, i) => {
            const heights = [100, 92, 84, 79, 72];
            return (
              <div key={step} className="flex flex-col items-center gap-2">
                <div className="w-full bg-gray-200 rounded relative" style={{ height: "80px" }}>
                  <div className="absolute bottom-0 w-full bg-blue-500 rounded" style={{ height: `${heights[i]}%` }} />
                </div>
                <span className="text-xs text-gray-500">{step}</span>
                <span className="text-xs font-medium">{heights[i]}%</span>
              </div>
            );
          })}
        </div>
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

export default function SurveyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const npsSurveys = useNpsSummary();

  const TAB_CONTENT: Record<Tab, React.ReactElement> = {
    overview:     <OverviewTab npsSurveys={npsSurveys} />,
    surveys:      <SurveysTab />,
    questions:    <QuestionsTab />,
    responses:    <ResponsesTab />,
    analytics:    <AnalyticsTab npsSurveys={npsSurveys} />,
    flowchart:    <FlowchartTab />,
    integrations: <IntegrationsTab />,
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
