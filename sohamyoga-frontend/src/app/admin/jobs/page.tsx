'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { jobsApi, JobPosting } from '@/lib/api';

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), { ssr: false });

type Tab = 'postings' | 'applications';
type AppStatus = 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected';

const EMPTY_JOB: Partial<JobPosting> = {
  title: '',
  department: 'Data Engineering',
  location: '',
  employmentType: 'Full-Time',
  salaryRange: '',
  summary: '',
  description: '',
  requirements: '',
  niceToHave: '',
  isActive: true,
  sortOrder: 0,
};

export default function AdminJobsPage() {
  const [tab, setTab] = useState<Tab>('postings');
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Parameters<typeof jobsApi.adminGetApplications> extends [infer _, infer __] ? never : Awaited<ReturnType<typeof jobsApi.adminGetApplications>>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<JobPosting> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobsApi.adminGetAll();
      setJobs(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobsApi.adminGetApplications(undefined, filterStatus || undefined);
      setApplications(data as never);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (tab === 'postings') loadJobs();
    else loadApplications();
  }, [tab, loadJobs, loadApplications]);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      if (editing.id) {
        await jobsApi.adminUpdate(editing.id, editing);
      } else {
        await jobsApi.adminCreate(editing);
      }
      setEditing(null);
      await loadJobs();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this job posting? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await jobsApi.adminDelete(id);
      await loadJobs();
    } catch {
      alert('Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  };

  const updateAppStatus = async (appId: number, status: AppStatus, notes?: string) => {
    try {
      await jobsApi.adminUpdateApplicationStatus(appId, status, notes);
      await loadApplications();
    } catch {
      alert('Failed to update status.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs & Careers</h1>
          <p className="text-gray-500 text-sm mt-1">Manage job postings and review applications</p>
        </div>
        {tab === 'postings' && (
          <button
            onClick={() => setEditing({ ...EMPTY_JOB })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Job Posting
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['postings', 'applications'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'postings' ? (
        <JobPostingsTable jobs={jobs} onEdit={setEditing} onDelete={handleDelete} deletingId={deletingId} />
      ) : (
        <ApplicationsTable
          applications={applications as never}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          onStatusChange={updateAppStatus}
        />
      )}

      {/* Edit/Create Modal */}
      {editing !== null && (
        <JobEditModal
          job={editing}
          onChange={setEditing}
          onSave={handleSave}
          onClose={() => { setEditing(null); setSaveError(''); }}
          saving={saving}
          error={saveError}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function JobPostingsTable({
  jobs, onEdit, onDelete, deletingId,
}: {
  jobs: JobPosting[];
  onEdit: (job: JobPosting) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
        </svg>
        <p className="text-gray-500">No job postings yet. Create your first one!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">Title</th>
            <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">Department</th>
            <th className="text-left px-4 py-3 text-gray-600 font-medium hidden lg:table-cell">Location</th>
            <th className="text-left px-4 py-3 text-gray-600 font-medium hidden sm:table-cell">Type</th>
            <th className="text-center px-4 py-3 text-gray-600 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-gray-600 font-medium">Apps</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{job.title}</div>
                <div className="text-xs text-gray-400">/{job.slug}</div>
              </td>
              <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{job.department}</td>
              <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{job.location}</td>
              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{job.employmentType}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${job.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {job.isActive ? 'Active' : 'Draft'}
                </span>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-gray-900">{job.applicationCount}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(job)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === job.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ApplicationsTable({ applications, filterStatus, onFilterChange, onStatusChange }: any) {
  const statuses = ['', 'New', 'Reviewed', 'Shortlisted', 'Rejected'];
  const statusColors: Record<string, string> = {
    New: 'bg-blue-100 text-blue-700',
    Reviewed: 'bg-yellow-100 text-yellow-700',
    Shortlisted: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">Filter by status:</span>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => onFilterChange(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterStatus === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-500">
          No applications found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Applicant</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium hidden md:table-cell">Position</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium hidden lg:table-cell">Applied</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app: Parameters<typeof ApplicationsTable>[0]['applications'][0]) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  statusColors={statusColors}
                  onStatusChange={onStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ApplicationRow({ app, statusColors, onStatusChange }: any) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.adminNotes || '');

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{app.name}</div>
          <div className="text-xs text-gray-500">{app.email}</div>
        </td>
        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{app.jobTitle || `Job #${app.jobPostingId}`}</td>
        <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
          {new Date(app.createdAt).toLocaleDateString('en-CA')}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[app.status] || 'bg-gray-100 text-gray-600'}`}>
            {app.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            {expanded ? 'Close' : 'Review'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-blue-50/40">
          <td colSpan={5} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                {app.phone && <p><span className="font-medium text-gray-700">Phone:</span> {app.phone}</p>}
                {app.linkedInUrl && (
                  <p>
                    <span className="font-medium text-gray-700">LinkedIn:</span>{' '}
                    <a href={app.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{app.linkedInUrl}</a>
                  </p>
                )}
                {app.portfolioUrl && (
                  <p>
                    <span className="font-medium text-gray-700">Portfolio:</span>{' '}
                    <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{app.portfolioUrl}</a>
                  </p>
                )}
                {app.coverLetter && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Cover Letter:</p>
                    <p className="text-gray-600 text-xs whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">{app.coverLetter}</p>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Update Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['New', 'Reviewed', 'Shortlisted', 'Rejected'] as AppStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => onStatusChange(app.id, s, notes)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          app.status === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Internal notes about this applicant..."
                  />
                  <button
                    onClick={() => onStatusChange(app.id, app.status, notes)}
                    className="mt-1 text-xs bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function JobEditModal({
  job, onChange, onSave, onClose, saving, error,
}: {
  job: Partial<JobPosting>;
  onChange: (j: Partial<JobPosting>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const set = (key: keyof JobPosting, val: unknown) => onChange({ ...job, [key]: val });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900">{job.id ? 'Edit Job Posting' : 'New Job Posting'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* Basic Info */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={job.title || ''}
                onChange={(e) => set('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g. Senior Data Engineer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={job.department || ''}
                onChange={(e) => set('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g. Data Engineering"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={job.location || ''}
                onChange={(e) => set('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g. Calgary, AB (Hybrid)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                value={job.employmentType || 'Full-Time'}
                onChange={(e) => set('employmentType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Co-op'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salary Range</label>
              <input
                type="text"
                value={job.salaryRange || ''}
                onChange={(e) => set('salaryRange', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="e.g. $90,000 – $120,000 CAD"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
              <textarea
                rows={2}
                value={job.summary || ''}
                onChange={(e) => set('summary', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                placeholder="One or two sentences describing this role..."
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Sort Order</label>
              <input
                type="number"
                value={job.sortOrder ?? 0}
                onChange={(e) => set('sortOrder', parseInt(e.target.value))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={job.isActive ?? true}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
              </label>
              <span className="text-sm font-medium text-gray-700">{job.isActive ? 'Active (visible on site)' : 'Draft (hidden)'}</span>
            </div>
          </div>

          {/* Rich Text Fields */}
          {([
            { key: 'description' as keyof JobPosting, label: 'Job Description', placeholder: 'Describe the role, responsibilities, and what the candidate will be doing...' },
            { key: 'requirements' as keyof JobPosting, label: 'Requirements', placeholder: 'List the required skills, experience, and qualifications...' },
            { key: 'niceToHave' as keyof JobPosting, label: 'Nice to Have (Optional)', placeholder: 'Bonus skills, certifications, or experience that would be great to have...' },
          ] as const).map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <RichTextEditor
                value={(job[key] as string) || ''}
                onChange={(html) => set(key, html)}
                placeholder={placeholder}
                minHeight="160px"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !job.title}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (job.id ? 'Save Changes' : 'Create Job Posting')}
          </button>
        </div>
      </div>
    </div>
  );
}
