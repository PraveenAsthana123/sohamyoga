'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { jobsApi, JobPosting, ApplyJobRequest } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';

export default function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ApplyJobRequest>({
    name: '',
    email: '',
    phone: '',
    linkedInUrl: '',
    portfolioUrl: '',
    coverLetter: '',
  });

  useEffect(() => {
    if (!slug) return;
    jobsApi
      .getBySlug(slug)
      .then(setJob)
      .catch(() => router.push('/careers'))
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    setSubmitting(true);
    setError('');
    try {
      await jobsApi.apply(job.id, form);
      setSubmitted(true);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 pt-32 pb-16 text-white">
        <div className="container mx-auto px-4">
          <Link href="/careers" className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Careers
          </Link>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-blue-600/30 border border-blue-400/40 rounded-full text-blue-300 text-sm">
              {job.department}
            </span>
            <span className="px-3 py-1 bg-green-600/30 border border-green-400/40 rounded-full text-green-300 text-sm">
              {job.employmentType}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{job.title}</h1>
          <div className="flex flex-wrap gap-6 text-blue-200 text-sm mb-8">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
            {job.salaryRange && (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {job.salaryRange}
              </span>
            )}
          </div>
          {!submitted ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
            >
              Apply Now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-400/40 text-green-300 px-6 py-3 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Application Submitted! We'll be in touch.
            </div>
          )}
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {job.summary && (
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">About This Role</h2>
                <p className="text-blue-800">{job.summary}</p>
              </div>
            )}

            {job.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
                <SafeHtml
                  html={job.description}
                  className="prose prose-blue max-w-none text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_strong]:font-semibold [&_strong]:text-gray-900"
                />
              </div>
            )}

            {job.requirements && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Requirements</h2>
                <SafeHtml
                  html={job.requirements}
                  className="prose prose-blue max-w-none text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:font-semibold"
                />
              </div>
            )}

            {job.niceToHave && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Nice to Have</h2>
                <SafeHtml
                  html={job.niceToHave}
                  className="prose prose-blue max-w-none text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:font-semibold"
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Overview</h3>
              <dl className="space-y-3 text-sm">
                {[
                  { label: 'Department', value: job.department },
                  { label: 'Location', value: job.location },
                  { label: 'Type', value: job.employmentType },
                  ...(job.salaryRange ? [{ label: 'Salary', value: job.salaryRange }] : []),
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <dt className="text-gray-500">{item.label}</dt>
                    <dd className="font-medium text-gray-900 text-right max-w-[60%]">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {!submitted && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Apply for This Role
                </button>
              )}
            </div>

            {/* Perks */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
              <h3 className="font-semibold mb-3">What We Offer</h3>
              <ul className="space-y-2 text-sm text-blue-100">
                {['Competitive salary & benefits', 'Hybrid / remote work options', 'Certification budget', 'Annual learning allowance', 'Health & dental coverage', 'Team events & retreats'].map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Application Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Apply for {job.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{job.department} · {job.location}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="jane@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="+1 (403) 555-0123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={form.linkedInUrl}
                  onChange={(e) => setForm({ ...form, linkedInUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio / GitHub URL</label>
                <input
                  type="url"
                  value={form.portfolioUrl}
                  onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="https://github.com/yourprofile"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter</label>
                <textarea
                  rows={5}
                  value={form.coverLetter}
                  onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  placeholder="Tell us why you're excited about this role and what makes you a great fit..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
