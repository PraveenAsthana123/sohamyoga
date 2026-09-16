'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScrapeJob = {
  id: string;
  business_name: string;
  business_url: string | null;
  platform: string;
  place_id: string | null;
  status: string;
  last_run_at: string | null;
  reviews_found: number;
  schedule: string;
  is_competitor: boolean;
  created_at: string;
};

type ScrapedReview = {
  id: string;
  job_id: string;
  platform: string;
  reviewer_name: string | null;
  star_rating: number | null;
  review_text: string | null;
  review_date: string | null;
  review_url: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  ai_summary: string | null;
  is_responded: boolean;
  response_text: string | null;
  is_mock: boolean;
  scraped_at: string;
  business_name?: string;
  is_competitor?: boolean;
};

type ResponseTemplate = {
  id: string;
  label: string;
  stars: number;
  text: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ['google', 'yelp', 'tripadvisor', 'facebook', 'trustpilot', 'g2', 'capterra'] as const;
const PLATFORM_ICONS: Record<string, string> = {
  google: '🔍',
  yelp: '⭐',
  tripadvisor: '✈️',
  facebook: '📘',
  trustpilot: '✅',
  g2: '💼',
  capterra: '📊',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-green-100 text-green-800',
  neutral: 'bg-gray-100 text-gray-700',
  negative: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

const DEFAULT_TEMPLATES: ResponseTemplate[] = [
  { id: 't1', label: '5-star', stars: 5, text: 'Thank you so much for the wonderful review! We are thrilled to hear about your positive experience and look forward to welcoming you back soon.' },
  { id: 't2', label: '4-star', stars: 4, text: 'Thank you for the positive feedback! We appreciate you taking the time to share your experience and are glad you enjoyed your time with us.' },
  { id: 't3', label: '3-star neutral', stars: 3, text: 'Thank you for taking the time to share your feedback. We value your input and are always looking for ways to improve the experience for our guests.' },
  { id: 't4', label: '2-star', stars: 2, text: "We're sorry to hear your experience didn't meet expectations. We take all feedback seriously and would love the opportunity to make it right. Please reach out to us directly." },
  { id: 't5', label: '1-star', stars: 1, text: 'We sincerely apologize for falling short of your expectations. This is not the standard we hold ourselves to. Please contact us directly so we can resolve this for you.' },
];

const TABS = ['jobs', 'reviews', 'sentiment', 'competitors', 'templates'] as const;
type Tab = typeof TABS[number];

// ─── Helper Components ────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-gray-400">—</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="text-yellow-500 text-sm">
      {'★'.repeat(full)}
      {half && '½'}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
      <span className="text-gray-500 ml-1">({rating})</span>
    </span>
  );
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current inline-block" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReviewScraperPage() {
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [reviews, setReviews] = useState<ScrapedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Job modal state
  const [showJobModal, setShowJobModal] = useState(false);
  const [editJob, setEditJob] = useState<ScrapeJob | null>(null);
  const [jobForm, setJobForm] = useState({ business_name: '', platform: 'google', business_url: '', place_id: '', schedule: 'manual', is_competitor: false });
  const [jobSaving, setJobSaving] = useState(false);

  // Scraping state
  const [scrapingJobId, setScrapingJobId] = useState<string | null>(null);
  const [scrapeWarning, setScrapeWarning] = useState('');

  // Review filters
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterRating, setFilterRating] = useState('');

  // Respond state
  const [respondingReviewId, setRespondingReviewId] = useState<string | null>(null);
  const [respondText, setRespondText] = useState('');
  const [respondSaving, setRespondSaving] = useState(false);

  // AI analysis
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<ResponseTemplate[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_TEMPLATES;
    try {
      const stored = localStorage.getItem('review_templates');
      return stored ? (JSON.parse(stored) as ResponseTemplate[]) : DEFAULT_TEMPLATES;
    } catch { return DEFAULT_TEMPLATES; }
  });
  const [templateAiLoading, setTemplateAiLoading] = useState<string | null>(null);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [editTemplateText, setEditTemplateText] = useState('');

  const saveTemplates = (tpls: ResponseTemplate[]) => {
    setTemplates(tpls);
    if (typeof window !== 'undefined') localStorage.setItem('review_templates', JSON.stringify(tpls));
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/review-scraper');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { jobs: ScrapeJob[]; reviews: ScrapedReview[] };
      setJobs(data.jobs || []);
      setReviews(data.reviews || []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Job CRUD ──────────────────────────────────────────────────────────────

  const openNewJob = () => {
    setEditJob(null);
    setJobForm({ business_name: '', platform: 'google', business_url: '', place_id: '', schedule: 'manual', is_competitor: false });
    setShowJobModal(true);
  };

  const openEditJob = (job: ScrapeJob) => {
    setEditJob(job);
    setJobForm({
      business_name: job.business_name,
      platform: job.platform,
      business_url: job.business_url || '',
      place_id: job.place_id || '',
      schedule: job.schedule,
      is_competitor: job.is_competitor,
    });
    setShowJobModal(true);
  };

  const saveJob = async () => {
    if (!jobForm.business_name.trim()) return;
    setJobSaving(true);
    try {
      if (editJob) {
        const res = await fetch(`/api/admin/review-scraper/${editJob.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobForm),
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        const res = await fetch('/api/admin/review-scraper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobForm),
        });
        if (!res.ok) throw new Error('Create failed');
      }
      setShowJobModal(false);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setJobSaving(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Delete this scrape job and all its reviews?')) return;
    try {
      await fetch(`/api/admin/review-scraper/${jobId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const runScrape = async (jobId: string) => {
    setScrapingJobId(jobId);
    setScrapeWarning('');
    try {
      const res = await fetch(`/api/admin/review-scraper/${jobId}/scrape`, { method: 'POST' });
      const data = await res.json() as { warning?: string };
      if (data.warning) setScrapeWarning(data.warning);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setScrapingJobId(null);
    }
  };

  // ── Reviews ───────────────────────────────────────────────────────────────

  const filteredReviews = useMemo(() => reviews.filter(r => {
    if (filterPlatform && r.platform !== filterPlatform) return false;
    if (filterSentiment && r.sentiment !== filterSentiment) return false;
    if (filterRating && String(Math.floor(r.star_rating || 0)) !== filterRating) return false;
    return true;
  }), [reviews, filterPlatform, filterSentiment, filterRating]);

  const saveResponse = async (review: ScrapedReview) => {
    if (!respondText.trim()) return;
    setRespondSaving(true);
    try {
      const res = await fetch(`/api/admin/review-scraper/${review.job_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id, response_text: respondText }),
      });
      if (!res.ok) throw new Error('Failed to save response');
      setRespondingReviewId(null);
      setRespondText('');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRespondSaving(false);
    }
  };

  const exportCSV = () => {
    const cols = ['reviewer_name', 'platform', 'star_rating', 'review_text', 'review_date', 'sentiment', 'is_responded'];
    const rows = filteredReviews.map(r => cols.map(c => JSON.stringify((r as Record<string, unknown>)[c] ?? '')).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'reviews.csv';
    a.click();
  };

  // ── Sentiment Stats ───────────────────────────────────────────────────────

  const sentimentStats = useMemo(() => {
    const total = reviews.length;
    const pos = reviews.filter(r => r.sentiment === 'positive').length;
    const neg = reviews.filter(r => r.sentiment === 'negative').length;
    const neu = reviews.filter(r => r.sentiment === 'neutral').length;
    const avgRating = total > 0 ? (reviews.reduce((s, r) => s + (r.star_rating || 0), 0) / total).toFixed(1) : '—';
    const pct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(0) + '%' : '—';

    const byPlatform: Record<string, { count: number; ratingSum: number; posCount: number }> = {};
    for (const r of reviews) {
      if (!byPlatform[r.platform]) byPlatform[r.platform] = { count: 0, ratingSum: 0, posCount: 0 };
      byPlatform[r.platform].count++;
      byPlatform[r.platform].ratingSum += r.star_rating || 0;
      if (r.sentiment === 'positive') byPlatform[r.platform].posCount++;
    }

    // Word frequency (top keywords from review texts)
    const stopwords = new Set(['the', 'and', 'a', 'an', 'is', 'in', 'it', 'of', 'to', 'was', 'for', 'my', 'i', 'are', 'this', 'that', 'on', 'with', 'very', 'so', 'be', 'we', 'but', 'not', 'have', 'they', 'at', 'as', 'had', 'by', 'from', 'or']);
    const positiveTexts = reviews.filter(r => r.sentiment === 'positive').map(r => r.review_text || '').join(' ');
    const negativeTexts = reviews.filter(r => r.sentiment === 'negative').map(r => r.review_text || '').join(' ');

    const wordFreq = (text: string) => {
      const freq: Record<string, number> = {};
      for (const w of text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []) {
        if (!stopwords.has(w)) freq[w] = (freq[w] || 0) + 1;
      }
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
    };

    return { total, pos, neg, neu, avgRating, pct, byPlatform, topPositive: wordFreq(positiveTexts), topNegative: wordFreq(negativeTexts) };
  }, [reviews]);

  const runAiAnalysis = async () => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      const sample = reviews.slice(0, 20).map(r => `[${r.sentiment?.toUpperCase()}] "${r.review_text?.slice(0, 150)}"`).join('\n');
      const prompt = `Analyze these customer reviews and provide a strategic business summary with key themes, top strengths, main pain points, and 3 actionable recommendations:\n\n${sample}`;
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false }),
      });
      const data = await res.json() as { text?: string; response?: string };
      setAiAnalysis(data.text || data.response || 'No response from AI');
    } catch (e) {
      setAiAnalysis(`AI analysis failed: ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Competitor Data ───────────────────────────────────────────────────────

  const ownJobs = jobs.filter(j => !j.is_competitor);
  const competitorJobs = jobs.filter(j => j.is_competitor);
  const ownReviews = reviews.filter(r => !r.is_competitor);
  const competitorReviews = reviews.filter(r => r.is_competitor);
  const avgOf = (revs: ScrapedReview[]) => revs.length > 0 ? (revs.reduce((s, r) => s + (r.star_rating || 0), 0) / revs.length).toFixed(2) : '—';

  // ── Template AI ───────────────────────────────────────────────────────────

  const improveTemplate = async (tpl: ResponseTemplate) => {
    setTemplateAiLoading(tpl.id);
    try {
      const prompt = `Improve this ${tpl.label} review response template to make it more warm, genuine, and professional. Keep it concise (2-3 sentences). Original: "${tpl.text}". Return ONLY the improved text.`;
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: false }),
      });
      const data = await res.json() as { text?: string; response?: string };
      const improved = (data.text || data.response || '').trim();
      if (improved) {
        const updated = templates.map(t => t.id === tpl.id ? { ...t, text: improved } : t);
        saveTemplates(updated);
      }
    } catch (e) {
      alert(`AI template improvement failed: ${(e as Error).message}`);
    } finally {
      setTemplateAiLoading(null);
    }
  };

  const copyTemplate = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Review Scraper</h1>
            <p className="text-sm text-gray-500 mt-0.5">Collect, analyze, and respond to reviews across all platforms</p>
          </div>
          {activeTab === 'jobs' && (
            <button onClick={openNewJob} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              + New Job
            </button>
          )}
          {activeTab === 'reviews' && (
            <button onClick={exportCSV} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
              Export CSV
            </button>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {t === 'jobs' ? 'Scrape Jobs' : t === 'reviews' ? 'All Reviews' : t === 'sentiment' ? 'Sentiment Analysis' : t === 'competitors' ? 'Competitor Reviews' : 'Response Templates'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {loading && <div className="text-center py-12 text-gray-500">Loading…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">{error}</div>}
        {scrapeWarning && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm">
            ⚠️ {scrapeWarning}
          </div>
        )}

        {/* ─── Tab: Scrape Jobs ─────────────────────────────────────────── */}
        {activeTab === 'jobs' && !loading && (
          <div>
            {jobs.length === 0 && <p className="text-gray-500 text-center py-8">No scrape jobs yet. Click &quot;New Job&quot; to get started.</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobs.map(job => (
                <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{PLATFORM_ICONS[job.platform] || '🔗'}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">{job.business_name}</h3>
                        <span className="text-xs text-gray-500 capitalize">{job.platform}</span>
                        {job.is_competitor && <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Competitor</span>}
                      </div>
                    </div>
                    <Badge label={job.status} colorClass={STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-600'} />
                  </div>
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <div>Reviews found: <span className="font-semibold text-gray-800">{job.reviews_found}</span></div>
                    <div>Schedule: <span className="capitalize">{job.schedule}</span></div>
                    <div>Last run: {job.last_run_at ? new Date(job.last_run_at).toLocaleDateString() : 'Never'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void runScrape(job.id)}
                      disabled={scrapingJobId === job.id || job.status === 'running'}
                      className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {scrapingJobId === job.id ? <><Spinner /> Running…</> : 'Run Scrape ▶'}
                    </button>
                    <button onClick={() => openEditJob(job)} className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Edit</button>
                    <button onClick={() => void deleteJob(job.id)} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Tab: All Reviews ─────────────────────────────────────────── */}
        {activeTab === 'reviews' && !loading && (
          <div>
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="border border-gray-300 rounded-lg text-sm px-3 py-2">
                <option value="">All Platforms</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {p}</option>)}
              </select>
              <select value={filterRating} onChange={e => setFilterRating(e.target.value)} className="border border-gray-300 rounded-lg text-sm px-3 py-2">
                <option value="">All Ratings</option>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} stars</option>)}
              </select>
              <select value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)} className="border border-gray-300 rounded-lg text-sm px-3 py-2">
                <option value="">All Sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <span className="text-sm text-gray-500 self-center">{filteredReviews.length} reviews</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {filteredReviews.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No reviews match the current filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Reviewer</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Platform</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Rating</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Review</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Sentiment</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredReviews.map(review => (
                        <>
                          <tr key={review.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {review.reviewer_name || 'Anonymous'}
                              {review.is_mock && <span className="ml-1 text-xs text-orange-500">[demo]</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1">
                                {PLATFORM_ICONS[review.platform] || '🔗'}
                                <span className="capitalize text-gray-600">{review.platform}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3"><StarDisplay rating={review.star_rating} /></td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs">
                              <span title={review.review_text || ''}>
                                {(review.review_text || '').slice(0, 100)}{(review.review_text || '').length > 100 && '…'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{review.review_date || '—'}</td>
                            <td className="px-4 py-3">
                              {review.sentiment ? (
                                <Badge label={review.sentiment} colorClass={SENTIMENT_COLORS[review.sentiment] || 'bg-gray-100 text-gray-600'} />
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {review.is_responded ? (
                                <span className="text-green-600 text-xs font-medium">✓ Responded</span>
                              ) : (
                                <button
                                  onClick={() => { setRespondingReviewId(review.id); setRespondText(''); }}
                                  className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                                >
                                  Respond
                                </button>
                              )}
                            </td>
                          </tr>
                          {respondingReviewId === review.id && (
                            <tr key={`${review.id}-respond`} className="bg-blue-50">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="flex gap-2">
                                  <textarea
                                    value={respondText}
                                    onChange={e => setRespondText(e.target.value)}
                                    placeholder="Write your response…"
                                    rows={2}
                                    className="flex-1 border border-blue-300 rounded-lg text-sm p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                  <div className="flex flex-col gap-1">
                                    <button
                                      onClick={() => void saveResponse(review)}
                                      disabled={respondSaving}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {respondSaving ? 'Saving…' : 'Save Response'}
                                    </button>
                                    <button
                                      onClick={() => setRespondingReviewId(null)}
                                      className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Tab: Sentiment Analysis ──────────────────────────────────── */}
        {activeTab === 'sentiment' && !loading && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Reviews', value: sentimentStats.total.toString(), color: 'bg-blue-50 text-blue-700' },
                { label: 'Avg Rating', value: sentimentStats.avgRating.toString(), color: 'bg-yellow-50 text-yellow-700' },
                { label: '% Positive', value: sentimentStats.pct(sentimentStats.pos), color: 'bg-green-50 text-green-700' },
                { label: '% Negative', value: sentimentStats.pct(sentimentStats.neg), color: 'bg-red-50 text-red-700' },
              ].map(card => (
                <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <div className="text-sm mt-1 opacity-80">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Sentiment breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Sentiment Distribution</h3>
              <div className="flex gap-4">
                {[
                  { label: 'Positive', count: sentimentStats.pos, color: 'bg-green-500' },
                  { label: 'Neutral', count: sentimentStats.neu, color: 'bg-gray-400' },
                  { label: 'Negative', count: sentimentStats.neg, color: 'bg-red-500' },
                ].map(s => (
                  <div key={s.label} className="flex-1">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{s.label}</span>
                      <span>{s.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${s.color} rounded-full transition-all`}
                        style={{ width: sentimentStats.total > 0 ? `${(s.count / sentimentStats.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-platform table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Per-Platform Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Platform</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Reviews</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Avg Rating</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">% Positive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(sentimentStats.byPlatform).map(([platform, stats]) => (
                    <tr key={platform}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span>{PLATFORM_ICONS[platform] || '🔗'}</span>
                        <span className="capitalize">{platform}</span>
                      </td>
                      <td className="px-4 py-3">{stats.count}</td>
                      <td className="px-4 py-3">{(stats.ratingSum / stats.count).toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <span className="text-green-700 font-medium">
                          {((stats.posCount / stats.count) * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-green-700">Top Positive Phrases</h3>
                <div className="flex flex-wrap gap-2">
                  {sentimentStats.topPositive.map(([word, count]) => (
                    <span key={word} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium">
                      {word} ({count})
                    </span>
                  ))}
                  {sentimentStats.topPositive.length === 0 && <span className="text-gray-400 text-sm">No data yet</span>}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 text-red-700">Top Complaint Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {sentimentStats.topNegative.map(([word, count]) => (
                    <span key={word} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium">
                      {word} ({count})
                    </span>
                  ))}
                  {sentimentStats.topNegative.length === 0 && <span className="text-gray-400 text-sm">No data yet</span>}
                </div>
              </div>
            </div>

            {/* AI Deep Analysis */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">AI Deep Analysis</h3>
                <button
                  onClick={() => void runAiAnalysis()}
                  disabled={aiLoading || reviews.length === 0}
                  className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {aiLoading ? <><Spinner /> Analyzing…</> : '🤖 AI Deep Analysis'}
                </button>
              </div>
              {aiAnalysis && (
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{aiAnalysis}</div>
              )}
              {!aiAnalysis && !aiLoading && (
                <p className="text-gray-400 text-sm">Click &quot;AI Deep Analysis&quot; to generate an Ollama-powered strategic summary of all reviews.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── Tab: Competitor Reviews ──────────────────────────────────── */}
        {activeTab === 'competitors' && !loading && (
          <div className="space-y-6">
            {/* Comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-2">Your Average Rating</div>
                <div className="text-4xl font-bold text-blue-700">{avgOf(ownReviews)}</div>
                <div className="text-sm text-gray-500 mt-1">{ownReviews.length} reviews across {ownJobs.length} business(es)</div>
                <div className="mt-3 text-green-600 text-sm font-medium">{sentimentStats.pct(sentimentStats.pos)} positive</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="text-sm font-medium text-gray-500 mb-2">Competitor Average Rating</div>
                <div className="text-4xl font-bold text-orange-600">{avgOf(competitorReviews)}</div>
                <div className="text-sm text-gray-500 mt-1">{competitorReviews.length} reviews across {competitorJobs.length} competitor(s)</div>
                <div className="mt-3 text-sm text-gray-400">
                  {competitorJobs.length === 0 && 'Add competitor jobs using the "This is a competitor" toggle in New Job'}
                </div>
              </div>
            </div>

            {/* Competitor job list */}
            {competitorJobs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Competitor Businesses</h3>
                  <button onClick={openNewJob} className="text-sm text-blue-600 hover:underline">+ Add Competitor</button>
                </div>
                <div className="divide-y divide-gray-100">
                  {competitorJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{PLATFORM_ICONS[job.platform]}</span>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{job.business_name}</div>
                          <div className="text-xs text-gray-500 capitalize">{job.platform} · {job.reviews_found} reviews</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void runScrape(job.id)}
                          disabled={scrapingJobId === job.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50"
                        >
                          {scrapingJobId === job.id ? 'Running…' : 'Scrape ▶'}
                        </button>
                        <button onClick={() => void deleteJob(job.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {competitorJobs.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-500 mb-4">No competitor jobs yet. Add a scrape job and toggle &quot;This is a competitor&quot; to start comparing.</p>
                <button onClick={openNewJob} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
                  + Add Competitor Job
                </button>
              </div>
            )}

            {/* Competitor reviews table */}
            {competitorReviews.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Competitor Reviews</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Business</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Reviewer</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Rating</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Review</th>
                        <th className="text-left px-4 py-3 text-gray-600 font-medium">Sentiment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {competitorReviews.map(r => (
                        <tr key={r.id}>
                          <td className="px-4 py-3 text-xs text-gray-600">{r.business_name || '—'}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{r.reviewer_name || 'Anonymous'}</td>
                          <td className="px-4 py-3"><StarDisplay rating={r.star_rating} /></td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">
                            {(r.review_text || '').slice(0, 100)}{(r.review_text || '').length > 100 && '…'}
                          </td>
                          <td className="px-4 py-3">
                            {r.sentiment ? <Badge label={r.sentiment} colorClass={SENTIMENT_COLORS[r.sentiment] || ''} /> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Response Templates ──────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-gray-500">Canned response templates stored in your browser. Use &quot;Generate AI Response&quot; to improve any template with Ollama.</p>
            {templates.map(tpl => (
              <div key={tpl.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{tpl.label}</span>
                    <span className="text-yellow-500">{'★'.repeat(tpl.stars)}{'☆'.repeat(5 - tpl.stars)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditTemplateId(tpl.id); setEditTemplateText(tpl.text); }}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void improveTemplate(tpl)}
                      disabled={templateAiLoading === tpl.id}
                      className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded hover:bg-purple-100 disabled:opacity-50 flex items-center gap-1"
                    >
                      {templateAiLoading === tpl.id ? <><Spinner /> Improving…</> : '🤖 Generate AI Response'}
                    </button>
                    <button
                      onClick={() => void copyTemplate(tpl.text)}
                      className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {editTemplateId === tpl.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editTemplateText}
                      onChange={e => setEditTemplateText(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = templates.map(t => t.id === tpl.id ? { ...t, text: editTemplateText } : t);
                          saveTemplates(updated);
                          setEditTemplateId(null);
                        }}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditTemplateId(null)} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 leading-relaxed">{tpl.text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Job Modal ─────────────────────────────────────────────────────── */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{editJob ? 'Edit Scrape Job' : 'New Scrape Job'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={jobForm.business_name}
                  onChange={e => setJobForm(f => ({ ...f, business_name: e.target.value }))}
                  placeholder="e.g. Soham Yoga Studio"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Platform *</label>
                <select
                  value={jobForm.platform}
                  onChange={e => setJobForm(f => ({ ...f, platform: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business URL</label>
                <input
                  type="url"
                  value={jobForm.business_url}
                  onChange={e => setJobForm(f => ({ ...f, business_url: e.target.value }))}
                  placeholder="https://www.yelp.com/biz/your-business"
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {jobForm.platform === 'google' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Google Place ID (optional)</label>
                  <input
                    type="text"
                    value={jobForm.place_id}
                    onChange={e => setJobForm(f => ({ ...f, place_id: e.target.value }))}
                    placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                    className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                <select
                  value={jobForm.schedule}
                  onChange={e => setJobForm(f => ({ ...f, schedule: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="manual">Manual</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={jobForm.is_competitor}
                  onChange={e => setJobForm(f => ({ ...f, is_competitor: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">This is a competitor</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => void saveJob()}
                disabled={jobSaving || !jobForm.business_name.trim()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {jobSaving ? 'Saving…' : editJob ? 'Update Job' : 'Create Job'}
              </button>
              <button onClick={() => setShowJobModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
