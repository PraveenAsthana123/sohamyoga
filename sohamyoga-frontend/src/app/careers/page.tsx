'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { jobsApi, JobPosting } from '@/lib/api';

export default function CareersPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [activeDept, setActiveDept] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([jobsApi.getAll(), jobsApi.getDepartments()])
      .then(([j, d]) => {
        setJobs(j);
        setDepartments(['All', ...d]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeDept === 'All' ? jobs : jobs.filter((j) => j.department === activeDept);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 pt-32 pb-16 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-blue-400"
              style={{ width: `${(i + 1) * 120}px`, height: `${(i + 1) * 120}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
            />
          ))}
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <span className="inline-block px-4 py-1 bg-blue-600/30 border border-blue-400/40 rounded-full text-blue-300 text-sm font-medium mb-4">
            Join Our Team
          </span>
          <h1 className="text-5xl font-bold mb-6">Teach with Us</h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            We're a studio team passionate about yoga, teaching, and building a welcoming
            community in Calgary.
          </p>
          <div className="flex flex-wrap gap-8 justify-center text-center">
            {[
              { num: '50+', label: 'Team Members' },
              { num: '100+', label: 'Clients Served' },
              { num: '10+', label: 'Years of Excellence' },
              { num: 'Hybrid', label: 'Work Model' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-blue-300">{s.num}</div>
                <div className="text-blue-200 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Open Positions</h2>
            <p className="text-gray-600">Find your next challenge and grow your career at SohamYoga.</p>
          </div>

          {/* Department Filter */}
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  activeDept === dept
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2" />
              </svg>
              <p className="text-lg font-medium">No open positions in this category right now.</p>
              <p className="text-sm mt-1">Check back soon or send us your resume.</p>
            </div>
          ) : (
            <div className="grid gap-6 max-w-4xl mx-auto">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Culture Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why SohamYoga?</h2>
            <p className="text-gray-600 max-w-xl mx-auto">We invest in our people. Here's what you can expect when you join our team.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: '🧘', title: 'Teach What You Love', desc: 'A studio that supports your teaching style and helps you grow as an instructor.' },
              { icon: '🏡', title: 'Flexible Scheduling', desc: 'We work with your availability to build a class schedule that fits.' },
              { icon: '🤝', title: 'Collaborative Culture', desc: 'A small, tight-knit team where your ideas are heard and your contributions are recognized.' },
              { icon: '🌱', title: 'Supportive Community', desc: 'Join a studio built around genuine care for students and staff alike.' },
              { icon: '📚', title: 'Ongoing Learning', desc: 'Opportunities to deepen your own practice alongside teaching.' },
              { icon: '🌍', title: 'Welcoming Team', desc: 'We are proud to have built an inclusive team.' },
            ].map((item) => (
              <div key={item.title} className="text-center p-6">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600 text-white text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Don't See a Fit?</h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            We're always looking for talented people. Send us your resume and we'll reach out when the right role opens up.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}

function JobCard({ job }: { job: JobPosting }) {
  return (
    <Link
      href={`/careers/${job.slug}`}
      className="block bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
              {job.department}
            </span>
            <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
              {job.employmentType}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
            {job.title}
          </h3>
          {job.summary && <p className="text-gray-600 text-sm line-clamp-2 mb-3">{job.summary}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </span>
            {job.salaryRange && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {job.salaryRange}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          <span className="flex items-center gap-1 text-blue-600 font-medium text-sm group-hover:gap-2 transition-all">
            Apply
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
