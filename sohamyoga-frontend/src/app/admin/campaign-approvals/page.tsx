'use client';
import { useEffect, useState } from 'react';

const TABS = ['pending', 'in_review', 'history', 'analytics'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  history: 'Approved / Rejected',
  analytics: 'Analytics',
};

interface CampaignApproval {
  id: string;
  campaign_name: string;
  client_name: string;
  client_email: string | null;
  campaign_type: string | null;
  budget_cad: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  assets_url: string | null;
  status: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  client_reviewing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  revision_requested: 'bg-amber-100 text-amber-700',
};

const TYPE_COLOR: Record<string, string> = {
  social: 'bg-purple-100 text-purple-700',
  email: 'bg-blue-100 text-blue-700',
  paid_ads: 'bg-orange-100 text-orange-700',
  seo: 'bg-green-100 text-green-700',
  content: 'bg-teal-100 text-teal-700',
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function fmtCad(val: string | number | null): string {
  if (val === null || val === undefined) return '—';
  return `$${Number(val).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-CA');
}

export default function CampaignApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [approvals, setApprovals] = useState<CampaignApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [reviewedBy, setReviewedBy] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/campaign-approvals', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setApprovals(d.approvals ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load approvals.'); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string, notes?: string, by?: string) {
    setSaving(true);
    await fetch(`/api/admin/campaign-approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_notes: notes || undefined, reviewed_by: by || undefined }),
    });
    setActionId(null);
    setActionStatus('');
    setActionNotes('');
    setReviewedBy('');
    setSaving(false);
    load();
  }

  const pending = approvals.filter(a => a.status === 'pending');
  const inReview = approvals.filter(a => a.status === 'client_reviewing');
  const history = approvals.filter(a => ['approved', 'rejected', 'revision_requested'].includes(a.status));

  const approved = approvals.filter(a => a.status === 'approved');
  const rejected = approvals.filter(a => a.status === 'rejected');
  const revisions = approvals.filter(a => a.status === 'revision_requested');
  const approvalRate = approved.length + rejected.length > 0
    ? Math.round((approved.length / (approved.length + rejected.length)) * 100)
    : 0;

  const avgTimeToApproval = approved
    .filter(a => a.reviewed_at)
    .map(a => Math.floor((new Date(a.reviewed_at!).getTime() - new Date(a.submitted_at).getTime()) / 86400000));
  const avgDays = avgTimeToApproval.length
    ? Math.round(avgTimeToApproval.reduce((a, b) => a + b, 0) / avgTimeToApproval.length)
    : null;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Campaign Approval Workflow</h1>
        <p className="mt-1 text-sm text-gray-500">Track campaign submissions, client reviews, and approvals across all accounts.</p>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {TAB_LABELS[t]}
            {t === 'pending' && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">Loading approvals…</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {/* PENDING TAB */}
          {tab === 'pending' && (
            <div className="space-y-4">
              {pending.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">No campaigns awaiting submission to client.</div>
              )}
              {pending.map(a => (
                <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{a.campaign_name}</h3>
                      <p className="text-sm text-gray-500">{a.client_name} · {a.client_email}</p>
                    </div>
                    <div className="flex gap-2">
                      {a.campaign_type && <Badge label={a.campaign_type} cls={TYPE_COLOR[a.campaign_type] ?? 'bg-gray-100 text-gray-600'} />}
                      <Badge label="Pending" cls={STATUS_COLOR.pending} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div><span className="text-gray-400">Budget:</span> <span className="font-medium">{fmtCad(a.budget_cad)}</span></div>
                    <div><span className="text-gray-400">Start:</span> <span>{fmtDate(a.start_date)}</span></div>
                    <div><span className="text-gray-400">End:</span> <span>{fmtDate(a.end_date)}</span></div>
                  </div>
                  {a.description && <p className="text-sm text-gray-600">{a.description}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-400">
                      Submitted {daysSince(a.submitted_at)} day{daysSince(a.submitted_at) !== 1 ? 's' : ''} ago by {a.submitted_by ?? 'unknown'}
                      {a.assets_url && <> · <a href={a.assets_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View Assets</a></>}
                    </div>
                    <button
                      onClick={() => updateStatus(a.id, 'client_reviewing')}
                      className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                    >
                      Send for Client Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* IN REVIEW TAB */}
          {tab === 'in_review' && (
            <div className="space-y-4">
              {inReview.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">No campaigns currently with client.</div>
              )}
              {inReview.map(a => {
                const days = daysSince(a.submitted_at);
                return (
                  <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{a.campaign_name}</h3>
                        <p className="text-sm text-gray-500">{a.client_name} · {a.client_email}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge label={`${days}d with client`} cls={days > 7 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-gray-400">Budget:</span> <span className="font-medium">{fmtCad(a.budget_cad)}</span></div>
                      <div><span className="text-gray-400">Type:</span> <span className="capitalize">{a.campaign_type ?? '—'}</span></div>
                      <div><span className="text-gray-400">Submitted by:</span> <span>{a.submitted_by ?? '—'}</span></div>
                    </div>

                    {actionId === a.id ? (
                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <select
                          value={actionStatus}
                          onChange={e => setActionStatus(e.target.value)}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        >
                          <option value="">— Select outcome —</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="revision_requested">Revision Requested</option>
                        </select>
                        <input
                          value={reviewedBy}
                          onChange={e => setReviewedBy(e.target.value)}
                          placeholder="Reviewed by (email)"
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        />
                        <textarea
                          value={actionNotes}
                          onChange={e => setActionNotes(e.target.value)}
                          placeholder="Review notes…"
                          rows={2}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(a.id, actionStatus, actionNotes, reviewedBy)}
                            disabled={!actionStatus || saving}
                            className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving ? 'Saving…' : 'Record Decision'}
                          </button>
                          <button onClick={() => setActionId(null)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => { setActionId(a.id); setActionStatus(''); setActionNotes(''); setReviewedBy(''); }}
                          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                        >
                          Record Decision
                        </button>
                        {a.client_email && (
                          <a
                            href={`mailto:${a.client_email}?subject=Reminder: ${encodeURIComponent(a.campaign_name)} awaiting your approval`}
                            className="text-sm border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50"
                          >
                            Send Reminder
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-4">
              {history.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">No reviewed campaigns yet.</div>
              )}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2">Campaign</th>
                      <th className="px-4 py-2">Client</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Reviewed by</th>
                      <th className="px-4 py-2">Review Date</th>
                      <th className="px-4 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{a.campaign_name}</td>
                        <td className="px-4 py-3 text-gray-600">{a.client_name}</td>
                        <td className="px-4 py-3">
                          {a.campaign_type && <Badge label={a.campaign_type} cls={TYPE_COLOR[a.campaign_type] ?? 'bg-gray-100 text-gray-600'} />}
                        </td>
                        <td className="px-4 py-3">
                          <Badge label={a.status.replace('_', ' ')} cls={STATUS_COLOR[a.status] ?? 'bg-gray-100 text-gray-600'} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">{a.reviewed_by ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(a.reviewed_at)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{a.review_notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {tab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg p-4 border-l-4 border-green-500 bg-green-50">
                  <p className="text-sm text-gray-500">Approval Rate</p>
                  <p className="text-2xl font-bold mt-1">{approvalRate}%</p>
                  <p className="text-xs text-gray-400 mt-1">{approved.length} approved / {approved.length + rejected.length} decided</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-blue-500 bg-blue-50">
                  <p className="text-sm text-gray-500">Avg Time to Approval</p>
                  <p className="text-2xl font-bold mt-1">{avgDays !== null ? `${avgDays}d` : '—'}</p>
                  <p className="text-xs text-gray-400 mt-1">From submission to approval</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-amber-500 bg-amber-50">
                  <p className="text-sm text-gray-500">Revisions Requested</p>
                  <p className="text-2xl font-bold mt-1">{revisions.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Requiring rework</p>
                </div>
                <div className="rounded-lg p-4 border-l-4 border-red-500 bg-red-50">
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold mt-1">{rejected.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Not approved</p>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Rejection / Revision Reasons</h3>
                {[...rejected, ...revisions].length === 0 ? (
                  <p className="text-sm text-gray-400">No rejections or revisions recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {[...rejected, ...revisions].map(a => (
                      <li key={a.id} className="flex gap-3 text-sm">
                        <Badge
                          label={a.status === 'rejected' ? 'Rejected' : 'Revision'}
                          cls={a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
                        />
                        <span className="font-medium">{a.campaign_name}</span>
                        <span className="text-gray-400">({a.client_name})</span>
                        {a.review_notes && <span className="text-gray-500 italic truncate max-w-xs">— {a.review_notes}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Campaign Type Breakdown</h3>
                <div className="space-y-2">
                  {Array.from(new Set(approvals.map(a => a.campaign_type).filter(Boolean))).map(type => {
                    const count = approvals.filter(a => a.campaign_type === type).length;
                    const pct = Math.round((count / approvals.length) * 100);
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-sm w-20 capitalize text-gray-600">{type}</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
