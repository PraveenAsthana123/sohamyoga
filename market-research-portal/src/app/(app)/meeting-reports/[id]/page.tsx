'use client';
import { useEffect, useState, use as usePromise } from 'react';

const SECTION_LABELS: Record<string, string> = {
  executiveBrief: 'Executive Brief', customerContext: 'Customer Context', marketSignals: 'Market Signals',
  competitorAndPricing: 'Competitor & Pricing', risks: 'Risks', questions: 'Questions to Ask', recommendedNextStep: 'Recommended Next Step',
  executiveSummary: 'Executive Summary', meetingNotes: 'Meeting Notes', needsAndObjections: 'Needs & Objections',
  decisions: 'Decisions', recommendations: 'Recommendations', followUpPlan: 'Follow-Up Plan',
};
const STATUSES = ['draft', 'review', 'approved', 'archived'];

interface Report {
  id: string; report_type: string; title: string; customer_name: string; meeting_at: string | null; status: string;
  objective: string; participants: string[]; sections: Record<string, string>; action_items: { text: string; owner?: string; due?: string }[];
}

export default function MeetingReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetch(`/api/meeting-reports/${id}`, { cache: 'no-store' }).then(r => r.json()).then(d => setReport(d.report));
  useEffect(() => { load(); }, [id]);

  if (!report) return <main className="p-6 text-sm text-gray-500">Loading…</main>;

  const sectionKeys = report.report_type === 'pre_meeting_brief'
    ? ['executiveBrief', 'customerContext', 'marketSignals', 'competitorAndPricing', 'risks', 'questions', 'recommendedNextStep']
    : ['executiveSummary', 'meetingNotes', 'needsAndObjections', 'decisions', 'competitorAndPricing', 'recommendations', 'followUpPlan'];

  async function save() {
    setSaving(true);
    setMessage('Saving…');
    try {
      const res = await fetch(`/api/meeting-reports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: report!.title, customerName: report!.customer_name, meetingAt: report!.meeting_at,
          objective: report!.objective, participants: report!.participants, sections: report!.sections,
          evidence: [], actionItems: report!.action_items, status: report!.status,
        }),
      });
      setMessage(res.ok ? 'Saved.' : 'Save failed.');
      if (res.ok) load();
    } finally {
      setSaving(false);
    }
  }

  const setSection = (key: string, value: string) => setReport({ ...report!, sections: { ...report!.sections, [key]: value } });

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <p className="text-sm text-gray-500">{report.customer_name} · {report.report_type === 'pre_meeting_brief' ? 'Pre-meeting brief (short)' : 'Post-meeting report (long)'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={report.status} onChange={e => setReport({ ...report, status: e.target.value })} className="rounded border p-2 text-sm">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <a href={`/api/meeting-reports/${id}/export`} className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white">⬇ Export PDF</a>
        </div>
      </div>

      <div className="rounded border bg-white p-4">
        <label className="text-xs font-semibold uppercase text-gray-500">Objective</label>
        <textarea className="mt-1 w-full rounded border p-2 text-sm" rows={2} value={report.objective}
          onChange={e => setReport({ ...report, objective: e.target.value })} />
      </div>

      {sectionKeys.map(key => (
        <div key={key} className="rounded border bg-white p-4">
          <label className="text-xs font-semibold uppercase text-gray-500">{SECTION_LABELS[key]}</label>
          <textarea className="mt-1 w-full rounded border p-2 text-sm" rows={4} value={report.sections?.[key] ?? ''}
            onChange={e => setSection(key, e.target.value)} placeholder={`Enter ${SECTION_LABELS[key].toLowerCase()}…`} />
        </div>
      ))}

      <div className="rounded border bg-white p-4">
        <label className="text-xs font-semibold uppercase text-gray-500">Action Items (one per line)</label>
        <textarea
          className="mt-1 w-full rounded border p-2 text-sm" rows={3}
          value={(report.action_items ?? []).map(a => a.text).join('\n')}
          onChange={e => setReport({ ...report, action_items: e.target.value.split('\n').filter(Boolean).map(text => ({ text })) })}
        />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <span className="text-sm text-gray-500">{message}</span>
      </div>
    </main>
  );
}
