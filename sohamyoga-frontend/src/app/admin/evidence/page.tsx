'use client';

import { useCallback, useEffect, useState } from 'react';

interface EvidenceRecord {
  id: string;
  subject_type: string;
  subject_id: string;
  evidence_type: string;
  claim: string;
  confidence: string;
  source_type: string;
  source_ref: string;
  collected_at: string;
  valid_until: string | null;
  created_by: string | null;
}

interface EvidenceData {
  total: number;
  records: EvidenceRecord[];
  byType: Record<string, number>;
  bySubjectType: Record<string, number>;
}

type TabKey = 'All Evidence' | 'By Type' | 'Add New';
const TABS: TabKey[] = ['All Evidence', 'By Type', 'Add New'];

const EVIDENCE_TYPES = ['FACT', 'ESTIMATE', 'INFERENCE', 'HYPOTHESIS', 'UNKNOWN'];
const CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

const TYPE_COLORS: Record<string, string> = {
  FACT: 'bg-green-100 text-green-700',
  ESTIMATE: 'bg-blue-100 text-blue-700',
  INFERENCE: 'bg-purple-100 text-purple-700',
  HYPOTHESIS: 'bg-amber-100 text-amber-700',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-orange-100 text-orange-700',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

function KpiCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
    </div>
  );
}

interface NewEvidenceForm {
  subject_type: string;
  subject_id: string;
  evidence_type: string;
  claim: string;
  confidence: string;
  source_type: string;
  source_ref: string;
}

const EMPTY_FORM: NewEvidenceForm = {
  subject_type: '',
  subject_id: '',
  evidence_type: 'FACT',
  claim: '',
  confidence: 'MEDIUM',
  source_type: '',
  source_ref: '',
};

export default function EvidencePage() {
  const [tab, setTab] = useState<TabKey>('All Evidence');
  const [data, setData] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [form, setForm] = useState<NewEvidenceForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/evidence', { cache: 'no-store' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const res = await fetch('/api/admin/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setSubmitSuccess(true);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  }, [form, load]);

  const filteredRecords = typeFilter
    ? (data?.records ?? []).filter((r) => r.evidence_type === typeFilter)
    : (data?.records ?? []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-gray-900">Evidence Ledger</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Every classified claim recorded in evidence_record — traceable to a real source. No claim stored without source_ref.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Total Records" value={data?.total ?? '—'} color="blue" />
          <KpiCard label="Facts" value={data?.byType?.FACT ?? 0} color="green" />
          <KpiCard label="Inferences" value={data?.byType?.INFERENCE ?? 0} color="purple" />
          <KpiCard label="Hypotheses" value={data?.byType?.HYPOTHESIS ?? 0} color="amber" />
        </div>

        <div className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading evidence records…</div>
        ) : tab === 'All Evidence' ? (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <label className="text-sm font-medium text-gray-700">Filter by type:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="">All types</option>
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <span className="ml-auto text-xs text-gray-400">{filteredRecords.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    {['Claim', 'Type', 'Confidence', 'Source', 'Subject', 'Collected'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="max-w-xs px-3 py-2 text-gray-800">{r.claim}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[r.evidence_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.evidence_type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[r.confidence] ?? 'bg-gray-100 text-gray-600'}`}>
                          {r.confidence}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        <div>{r.source_type}</div>
                        <div className="truncate max-w-[150px] text-gray-400">{r.source_ref}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        <div>{r.subject_type}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {new Date(r.collected_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {!filteredRecords.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No evidence records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'By Type' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {EVIDENCE_TYPES.map((type) => {
              const records = (data?.records ?? []).filter((r) => r.evidence_type === type);
              return (
                <div key={type} className="rounded-lg border bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`rounded px-2 py-0.5 text-sm font-medium ${TYPE_COLORS[type]}`}>{type}</span>
                    <span className="text-lg font-bold text-gray-900">{records.length}</span>
                  </div>
                  {records.slice(0, 3).map((r) => (
                    <div key={r.id} className="mb-2 border-b border-gray-100 pb-2 last:border-0">
                      <p className="text-sm text-gray-700 line-clamp-2">{r.claim}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{r.source_type} · {new Date(r.collected_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {!records.length && <p className="text-sm text-gray-400">No {type} records yet.</p>}
                  {records.length > 3 && (
                    <p className="mt-2 text-xs text-gray-400">+{records.length - 3} more — see All Evidence tab</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Add New tab */
          <div className="mx-auto max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-800">Record a New Evidence Entry</h3>
            {submitSuccess && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Evidence record created successfully.
              </div>
            )}
            {submitError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Subject Type</label>
                  <input
                    value={form.subject_type}
                    onChange={(e) => setForm({ ...form, subject_type: e.target.value })}
                    placeholder="e.g. customer, campaign"
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Subject ID (UUID)</label>
                  <input
                    value={form.subject_id}
                    onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    placeholder="UUID of the subject"
                    className="w-full rounded border px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Evidence Type</label>
                  <select
                    value={form.evidence_type}
                    onChange={(e) => setForm({ ...form, evidence_type: e.target.value })}
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  >
                    {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Confidence</label>
                  <select
                    value={form.confidence}
                    onChange={(e) => setForm({ ...form, confidence: e.target.value })}
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  >
                    {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Claim</label>
                <textarea
                  value={form.claim}
                  onChange={(e) => setForm({ ...form, claim: e.target.value })}
                  placeholder="State the claim being recorded..."
                  rows={3}
                  className="w-full rounded border px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Source Type</label>
                  <input
                    value={form.source_type}
                    onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                    placeholder="e.g. survey, analytics, admin"
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Source Reference</label>
                  <input
                    value={form.source_ref}
                    onChange={(e) => setForm({ ...form, source_ref: e.target.value })}
                    placeholder="URL, ID, or doc reference"
                    className="w-full rounded border px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.subject_type || !form.subject_id || !form.claim || !form.source_type || !form.source_ref}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save Evidence Record'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
