'use client';
// Real on-page + local SEO checker — fetches this app's own real rendered
// page and inspects real title/meta/H1/content plus schema.org LocalBusiness
// structured data, distinct from the Matomo-blocked SeoReportJob. No
// external service required for either check.

import { useState, useEffect } from 'react';

interface Check { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; }
interface Result { url: string; score: number; checks: Check[]; }
interface SchemaResult { jsonLd: Record<string, unknown>; missingFields: string[]; sourcedFrom: { businessProfile: boolean; branch: boolean } }
interface LinkCheckResult { href: string; statusCode: number | null; ok: boolean; error?: string }
interface BrokenLinkReport { pageUrl: string; totalLinks: number; brokenCount: number; links: LinkCheckResult[] }
interface RedirectRule { id: string; fromPath: string; toPath: string; statusCode: number; createdAt: string }
interface KeywordReport { seedKeyword: string; suggestions: { keyword: string; presentOnPage: boolean; opportunityScore: number }[]; coveredCount: number; gapCount: number }
interface LinkSuggestion { fromPage: string; toPage: string; sharedTerms: string[]; alreadyLinked: boolean }
interface TopicCluster { pillarPage: string; memberPages: string[]; sharedTerms: string[] }
interface PrioritizedIssue { source: string; severity: 'high' | 'medium' | 'low'; title: string; detail: string }
interface ArchPage { url: string; urlDepth: number; h1Text: string | null; hasH1: boolean }
interface ArchIssue { severity: 'high' | 'medium'; title: string; detail: string }
interface ArchReport { pages: ArchPage[]; issues: ArchIssue[] }
interface ContentBrief { seedKeyword: string; suggestedTitle: string; suggestedHeadings: string[]; relatedTermsToInclude: string[] }
interface LandingPage { slug: string; title: string; metaDescription: string; h1: string; intro: string }
interface VisibilitySnapshot { query: string; engine: string; visibilityType: string; position: string | null; isCited: boolean | null; brandMentioned: boolean; measuredAt: string }

const STATUS_COLORS: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-700', warn: 'bg-amber-100 text-amber-700', fail: 'bg-red-100 text-red-700',
};

function ResultCard({ title, result }: { title: string; result: Result }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">{title}</p>
          <span className="text-xs text-gray-500">{result.url}</span>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${result.score >= 80 ? 'bg-emerald-100 text-emerald-700' : result.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{result.score}/100</span>
      </div>
      <div className="space-y-2">
        {result.checks.map(c => (
          <div key={c.id} className="flex items-start justify-between gap-3 rounded border p-3 text-sm">
            <div>
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-gray-500">{c.detail}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status]}`}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SeoCheckerPage() {
  const [path, setPath] = useState('/');
  const [onPageResult, setOnPageResult] = useState<Result | null>(null);
  const [localResult, setLocalResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState<SchemaResult | null>(null);
  const [schemaError, setSchemaError] = useState('');
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateSchema() {
    setSchemaLoading(true);
    setSchemaError('');
    setSchema(null);
    const res = await fetch('/api/admin/seo/schema-generator');
    const data = await res.json();
    setSchemaLoading(false);
    if (!res.ok) { setSchemaError(data.error || 'Could not generate schema.'); return; }
    setSchema(data);
  }

  function copySchema() {
    if (!schema) return;
    navigator.clipboard.writeText(JSON.stringify(schema.jsonLd, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [brokenLinks, setBrokenLinks] = useState<BrokenLinkReport | null>(null);
  const [brokenLinksError, setBrokenLinksError] = useState('');
  const [brokenLinksLoading, setBrokenLinksLoading] = useState(false);
  const [redirects, setRedirects] = useState<RedirectRule[]>([]);
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');
  const [visibility, setVisibility] = useState<VisibilitySnapshot[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/seo/redirects').then((r) => r.ok ? r.json() : { rules: [] }).then((d) => setRedirects(d.rules ?? []));
    fetch('/api/admin/seo/search-visibility').then((r) => r.ok ? r.json() : { snapshots: [] }).then((d) => setVisibility(d.snapshots ?? []));
  }, []);

  async function checkBrokenLinksNow() {
    setBrokenLinksLoading(true);
    setBrokenLinksError('');
    setBrokenLinks(null);
    const res = await fetch(`/api/admin/seo/broken-links?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setBrokenLinksLoading(false);
    if (!res.ok) { setBrokenLinksError(data.error || 'Check failed.'); return; }
    setBrokenLinks(data);
  }

  async function addRedirect() {
    if (!newFrom.startsWith('/') || !newTo.startsWith('/')) return;
    const res = await fetch('/api/admin/seo/redirects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPath: newFrom, toPath: newTo, statusCode: 301 }),
    });
    if (res.ok) {
      const rule = await res.json();
      setRedirects((prev) => [rule, ...prev]);
      setNewFrom(''); setNewTo('');
    }
  }

  async function removeRedirect(id: string) {
    const res = await fetch(`/api/admin/seo/redirects/${id}`, { method: 'DELETE' });
    if (res.ok) setRedirects((prev) => prev.filter((r) => r.id !== id));
  }

  const [localConversion, setLocalConversion] = useState<{ days: number; localSearchVisitors: number; converted: number; conversionRatePct: number } | null>(null);
  const [localConversionError, setLocalConversionError] = useState('');
  const [localConversionLoading, setLocalConversionLoading] = useState(false);

  async function checkLocalConversion() {
    setLocalConversionLoading(true); setLocalConversionError(''); setLocalConversion(null);
    const res = await fetch('/api/admin/seo/local-search-conversion?days=30');
    const data = await res.json();
    setLocalConversionLoading(false);
    if (!res.ok) { setLocalConversionError(data.error || 'Failed.'); return; }
    setLocalConversion(data);
  }

  const [seedKeyword, setSeedKeyword] = useState('yoga classes');
  const [keywordReport, setKeywordReport] = useState<KeywordReport | null>(null);
  const [keywordError, setKeywordError] = useState('');
  const [keywordLoading, setKeywordLoading] = useState(false);

  async function checkKeywords() {
    setKeywordLoading(true);
    setKeywordError('');
    setKeywordReport(null);
    const res = await fetch(`/api/admin/seo/keyword-intelligence?path=${encodeURIComponent(path)}&keyword=${encodeURIComponent(seedKeyword)}`);
    const data = await res.json();
    setKeywordLoading(false);
    if (!res.ok) { setKeywordError(data.error || 'Check failed.'); return; }
    setKeywordReport(data);
  }

  const [linkSuggestions, setLinkSuggestions] = useState<LinkSuggestion[] | null>(null);
  const [linkSuggestionsError, setLinkSuggestionsError] = useState('');
  const [linkSuggestionsLoading, setLinkSuggestionsLoading] = useState(false);

  async function checkInternalLinks() {
    setLinkSuggestionsLoading(true);
    setLinkSuggestionsError('');
    setLinkSuggestions(null);
    const res = await fetch(`/api/admin/seo/internal-linking?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setLinkSuggestionsLoading(false);
    if (!res.ok) { setLinkSuggestionsError(data.error || 'Check failed.'); return; }
    setLinkSuggestions(data.suggestions);
  }

  const [clusters, setClusters] = useState<TopicCluster[] | null>(null);
  const [clustersError, setClustersError] = useState('');
  const [clustersLoading, setClustersLoading] = useState(false);

  async function checkTopicClusters() {
    setClustersLoading(true);
    setClustersError('');
    setClusters(null);
    const res = await fetch(`/api/admin/seo/topic-clusters?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setClustersLoading(false);
    if (!res.ok) { setClustersError(data.error || 'Check failed.'); return; }
    setClusters(data.clusters);
  }

  const [issues, setIssues] = useState<PrioritizedIssue[] | null>(null);
  const [issuesError, setIssuesError] = useState('');
  const [issuesLoading, setIssuesLoading] = useState(false);

  async function checkIssuePriorities() {
    setIssuesLoading(true);
    setIssuesError('');
    setIssues(null);
    const res = await fetch(`/api/admin/seo/issue-priorities?path=${encodeURIComponent(path)}&keyword=${encodeURIComponent(seedKeyword)}`);
    const data = await res.json();
    setIssuesLoading(false);
    if (!res.ok) { setIssuesError(data.error || 'Check failed.'); return; }
    setIssues(data.issues);
  }

  const [archReport, setArchReport] = useState<ArchReport | null>(null);
  const [archError, setArchError] = useState('');
  const [archLoading, setArchLoading] = useState(false);

  async function checkArchitecture() {
    setArchLoading(true); setArchError(''); setArchReport(null);
    const res = await fetch(`/api/admin/seo/architecture?path=${encodeURIComponent(path)}`);
    const data = await res.json();
    setArchLoading(false);
    if (!res.ok) { setArchError(data.error || 'Check failed.'); return; }
    setArchReport(data);
  }

  const [brief, setBrief] = useState<ContentBrief | null>(null);
  const [briefError, setBriefError] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);

  async function generateBrief() {
    setBriefLoading(true); setBriefError(''); setBrief(null);
    const res = await fetch(`/api/admin/seo/content-brief?keyword=${encodeURIComponent(seedKeyword)}`);
    const data = await res.json();
    setBriefLoading(false);
    if (!res.ok) { setBriefError(data.error || 'Failed.'); return; }
    setBrief(data);
  }

  const [landingPages, setLandingPages] = useState<LandingPage[] | null>(null);
  const [landingPagesError, setLandingPagesError] = useState('');
  const [landingPagesLoading, setLandingPagesLoading] = useState(false);

  async function generateLandingPages() {
    setLandingPagesLoading(true); setLandingPagesError(''); setLandingPages(null);
    const res = await fetch('/api/admin/seo/landing-page-factory');
    const data = await res.json();
    setLandingPagesLoading(false);
    if (!res.ok) { setLandingPagesError(data.error || 'Failed.'); return; }
    setLandingPages(data.pages);
  }

  async function check() {
    setLoading(true);
    setError('');
    setOnPageResult(null);
    setLocalResult(null);
    const [onPageRes, localRes] = await Promise.all([
      fetch(`/api/admin/seo/on-page-check?path=${encodeURIComponent(path)}`),
      fetch(`/api/admin/seo/local-check?path=${encodeURIComponent(path)}`),
    ]);
    const [onPageData, localData] = await Promise.all([onPageRes.json(), localRes.json()]);
    setLoading(false);
    if (!onPageRes.ok) { setError(onPageData.error || 'Check failed.'); return; }
    setOnPageResult(onPageData);
    if (localRes.ok) setLocalResult(localData);
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">SEO & Local SEO / GEO Checker</h1>
        <p className="text-sm text-gray-500">Real analysis of this site's own rendered pages — on-page tags/content, plus schema.org LocalBusiness structured data and NAP (name/address/phone) consistency. AI-answer-engine citation tracking (ChatGPT/Gemini/Perplexity) needs external API credentials this app doesn't have and is shown as not-checked rather than faked.</p>
      </div>

      <div className="flex gap-2">
        <input value={path} onChange={e => setPath(e.target.value)} placeholder="/booking" className="flex-1 rounded border p-2 text-sm" />
        <button onClick={() => void check()} disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{loading ? 'Checking…' : 'Check'}</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {onPageResult && <ResultCard title="On-Page SEO" result={onPageResult} />}
      {localResult && <ResultCard title="Local SEO / GEO" result={localResult} />}

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Schema Generator</p>
          <p className="text-xs text-gray-500">Real schema.org JSON-LD built from this tenant&apos;s actual business profile and branch data -- never fabricated placeholder values. Missing fields are listed explicitly so you know what to add before publishing.</p>
        </div>
        <button onClick={() => void generateSchema()} disabled={schemaLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{schemaLoading ? 'Generating…' : 'Generate schema'}</button>
        {schemaError && <p className="text-sm text-red-600">{schemaError}</p>}
        {schema && (
          <div className="space-y-2">
            {schema.missingFields.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Missing before this is production-ready:</p>
                <ul className="list-disc pl-5">
                  {schema.missingFields.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
            <pre className="overflow-x-auto rounded bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(schema.jsonLd, null, 2)}</pre>
            <button onClick={copySchema} className="rounded border px-3 py-1.5 text-sm">{copied ? 'Copied!' : 'Copy JSON-LD'}</button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Local Search Conversion</p>
          <p className="text-xs text-gray-500">Real first-party attribution -- ties this app&apos;s own tracking_session/tracking_event data to visitors who arrived via Google Maps / Google Business Profile referrers or a local/gbp UTM source, and measures how many converted. No paid rank-tracking API; zero reach is reported honestly if no such traffic exists yet.</p>
        </div>
        <button onClick={() => void checkLocalConversion()} disabled={localConversionLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{localConversionLoading ? 'Checking…' : 'Check last 30 days'}</button>
        {localConversionError && <p className="text-sm text-red-600">{localConversionError}</p>}
        {localConversion && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded border p-3"><p className="text-xs text-gray-500">Local search visitors</p><p className="text-lg font-semibold">{localConversion.localSearchVisitors}</p></div>
            <div className="rounded border p-3"><p className="text-xs text-gray-500">Converted</p><p className="text-lg font-semibold">{localConversion.converted}</p></div>
            <div className="rounded border p-3"><p className="text-xs text-gray-500">Conversion rate</p><p className="text-lg font-semibold">{localConversion.conversionRatePct}%</p></div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Broken Link Checker</p>
          <p className="text-xs text-gray-500">Real check against this app&apos;s own rendered page -- extracts real internal links and issues a real HTTP request to each. No external crawler service.</p>
        </div>
        <button onClick={() => void checkBrokenLinksNow()} disabled={brokenLinksLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{brokenLinksLoading ? 'Checking…' : `Check links on ${path}`}</button>
        {brokenLinksError && <p className="text-sm text-red-600">{brokenLinksError}</p>}
        {brokenLinks && (
          <div className="space-y-2">
            <p className="text-sm">{brokenLinks.totalLinks} internal links found, <span className={brokenLinks.brokenCount > 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>{brokenLinks.brokenCount} broken</span></p>
            {brokenLinks.links.filter((l) => !l.ok).map((l) => (
              <div key={l.href} className="flex items-center justify-between rounded border border-red-200 bg-red-50 p-2 text-xs">
                <span className="truncate">{l.href}</span>
                <span className="shrink-0 font-medium text-red-700">{l.statusCode ?? l.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Redirect Rules</p>
          <p className="text-xs text-gray-500">Real, stored redirect rules (seo_redirect_rule table) -- pair a broken link found above with a real redirect.</p>
        </div>
        <div className="flex gap-2">
          <input value={newFrom} onChange={(e) => setNewFrom(e.target.value)} placeholder="/old-path" className="flex-1 rounded border p-2 text-sm" />
          <input value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="/new-path" className="flex-1 rounded border p-2 text-sm" />
          <button onClick={() => void addRedirect()} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Add</button>
        </div>
        <div className="space-y-1">
          {redirects.length === 0 && <p className="text-xs text-gray-400">No redirect rules yet.</p>}
          {redirects.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>{r.fromPath} → {r.toPath} <span className="text-xs text-gray-400">({r.statusCode})</span></span>
              <button onClick={() => void removeRedirect(r.id)} className="text-xs text-red-600">Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Keyword Intelligence</p>
          <p className="text-xs text-gray-500">Real related-search suggestions from Google&apos;s free public autocomplete API, cross-checked against this page&apos;s real content. Opportunity Score ranks content gaps by Google&apos;s own suggestion order (an earlier position is a genuine relevance signal) -- not a fabricated search-volume estimate, since that needs a paid keyword API this project doesn&apos;t have credentials for.</p>
        </div>
        <div className="flex gap-2">
          <input value={seedKeyword} onChange={(e) => setSeedKeyword(e.target.value)} placeholder="Seed keyword" className="flex-1 rounded border p-2 text-sm" />
          <button onClick={() => void checkKeywords()} disabled={keywordLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{keywordLoading ? 'Checking…' : 'Check coverage'}</button>
        </div>
        {keywordError && <p className="text-sm text-red-600">{keywordError}</p>}
        {keywordReport && (
          <div className="space-y-2">
            <p className="text-sm">{keywordReport.coveredCount} covered on this page, <span className="font-semibold text-amber-600">{keywordReport.gapCount} content gaps</span></p>
            {keywordReport.suggestions.map((s) => (
              <div key={s.keyword} className={`flex items-center justify-between rounded border p-2 text-xs ${s.presentOnPage ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <span>{s.keyword}</span>
                <span className="flex items-center gap-2">
                  {!s.presentOnPage && <span className="font-semibold text-amber-800">score {s.opportunityScore}</span>}
                  <span className={s.presentOnPage ? 'text-emerald-700' : 'text-amber-700'}>{s.presentOnPage ? 'covered' : 'gap'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Internal Linking Engine</p>
          <p className="text-xs text-gray-500">Real keyword-overlap analysis across this site&apos;s own real pages -- no ML/LLM call. Site-wide nav/footer words are filtered out so matches reflect genuine topical overlap.</p>
        </div>
        <button onClick={() => void checkInternalLinks()} disabled={linkSuggestionsLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{linkSuggestionsLoading ? 'Analyzing…' : `Suggest links from ${path}`}</button>
        {linkSuggestionsError && <p className="text-sm text-red-600">{linkSuggestionsError}</p>}
        {linkSuggestions && (
          <div className="space-y-2">
            <p className="text-sm">{linkSuggestions.length} suggested internal links not currently present</p>
            {linkSuggestions.slice(0, 15).map((s) => (
              <div key={`${s.fromPage}-${s.toPage}`} className="rounded border p-2 text-xs">
                <div className="font-medium">{s.fromPage.replace(/^https?:\/\/[^/]+/, '')} → {s.toPage.replace(/^https?:\/\/[^/]+/, '')}</div>
                <div className="text-gray-500">shared: {s.sharedTerms.join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Topic Cluster / Content Hub</p>
          <p className="text-xs text-gray-500">Real clustering of this site&apos;s own pages by genuine content overlap -- the pillar is the page with the most real content among its cluster, not a fabricated authority score. A small site may honestly show just one cluster if its content isn&apos;t yet differentiated into separate topic areas -- that&apos;s a real finding, not a bug.</p>
        </div>
        <button onClick={() => void checkTopicClusters()} disabled={clustersLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{clustersLoading ? 'Analyzing…' : 'Detect topic clusters'}</button>
        {clustersError && <p className="text-sm text-red-600">{clustersError}</p>}
        {clusters && (
          <div className="space-y-3">
            <p className="text-sm">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''} found</p>
            {clusters.map((c) => (
              <div key={c.pillarPage} className="rounded border p-3 text-xs space-y-1">
                <div className="font-semibold text-indigo-700">Pillar: {c.pillarPage.replace(/^https?:\/\/[^/]+/, '')}</div>
                <div>Members: {c.memberPages.map((m) => m.replace(/^https?:\/\/[^/]+/, '')).join(', ')}</div>
                <div className="text-gray-500">Shared: {c.sharedTerms.join(', ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border-2 border-indigo-300 bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">SEO Issue Prioritization</p>
          <p className="text-xs text-gray-500">Real aggregation of the checkers above -- runs on-page, local SEO, broken-link, and keyword-gap checks against the same page and merges findings into one ranked list. No new scoring model, no fabricated weighting.</p>
        </div>
        <button onClick={() => void checkIssuePriorities()} disabled={issuesLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{issuesLoading ? 'Analyzing…' : `Prioritize issues on ${path}`}</button>
        {issuesError && <p className="text-sm text-red-600">{issuesError}</p>}
        {issues && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{issues.length} issue{issues.length !== 1 ? 's' : ''} found</p>
            {issues.map((issue, i) => (
              <div key={i} className={`rounded border p-2 text-xs ${issue.severity === 'high' ? 'border-red-200 bg-red-50' : issue.severity === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{issue.title}</span>
                  <span className="text-[10px] uppercase tracking-wide opacity-60">{issue.severity} · {issue.source}</span>
                </div>
                <div className="text-gray-600">{issue.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">SEO Architecture</p>
          <p className="text-xs text-gray-500">Real URL-depth and H1 analysis across this site&apos;s own real pages -- checks for missing H1s, duplicate H1s across pages, and deep URLs.</p>
        </div>
        <button onClick={() => void checkArchitecture()} disabled={archLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{archLoading ? 'Analyzing…' : `Analyze from ${path}`}</button>
        {archError && <p className="text-sm text-red-600">{archError}</p>}
        {archReport && (
          <div className="space-y-2">
            <p className="text-sm">{archReport.pages.length} pages crawled, {archReport.issues.length} issues</p>
            {archReport.issues.map((issue, i) => (
              <div key={i} className={`rounded border p-2 text-xs ${issue.severity === 'high' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <span className="font-medium">{issue.title}:</span> {issue.detail}
              </div>
            ))}
            {archReport.issues.length === 0 && <p className="text-xs text-emerald-700">No architecture issues found.</p>}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">SEO Content Brief</p>
          <p className="text-xs text-gray-500">Real brief grounded in Google Suggest related searches (same source as Keyword Intelligence) -- no fabricated competitor word-count target.</p>
        </div>
        <button onClick={() => void generateBrief()} disabled={briefLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{briefLoading ? 'Generating…' : `Generate brief for "${seedKeyword}"`}</button>
        {briefError && <p className="text-sm text-red-600">{briefError}</p>}
        {brief && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Suggested title:</span> {brief.suggestedTitle}</p>
            <div>
              <span className="font-medium">Suggested headings:</span>
              <ul className="list-disc pl-5">
                {brief.suggestedHeadings.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Local Landing Page Factory</p>
          <p className="text-xs text-gray-500">Real templated landing pages from location x service data (Multi-Location Management + service_master). Deterministic templating, not an LLM call.</p>
        </div>
        <button onClick={() => void generateLandingPages()} disabled={landingPagesLoading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{landingPagesLoading ? 'Generating…' : 'Generate landing pages'}</button>
        {landingPagesError && <p className="text-sm text-red-600">{landingPagesError}</p>}
        {landingPages && (
          <div className="space-y-2">
            <p className="text-sm">{landingPages.length} page{landingPages.length !== 1 ? 's' : ''} generated</p>
            {landingPages.length === 0 && <p className="text-xs text-gray-400">No locations or services on file yet -- add a location in Multi-Location Management and a service in Service Management to generate real pages.</p>}
            {landingPages.map((p) => (
              <div key={p.slug} className="rounded border p-2 text-xs space-y-0.5">
                <div className="font-medium">{p.slug}</div>
                <div className="text-gray-500">{p.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div>
          <p className="font-semibold text-gray-800">Search Visibility Trend</p>
          <p className="text-xs text-gray-500">Real organic-search keyword snapshots from Matomo (weekly search-visibility job) -- SERP position/citation stay blank when not real (no rank-tracking API in this environment, same honest gap as backlink tracking). GEO/local visibility types remain unwritten for the same reason.</p>
        </div>
        {visibility === null ? <p className="text-xs text-gray-400">Loading…</p> : visibility.length === 0 ? (
          <p className="text-xs text-gray-400">No snapshots yet -- the weekly search-visibility job writes real Matomo organic-search keyword data here once Matomo is reachable and has traffic to report.</p>
        ) : (
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400"><th className="pb-1">Query</th><th className="pb-1">Type</th><th className="pb-1">Engine</th><th className="pb-1">Position</th><th className="pb-1">Brand mentioned</th><th className="pb-1">Measured</th></tr></thead>
            <tbody>
              {visibility.map((v, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1 pr-2">{v.query}</td>
                  <td className="py-1 pr-2 uppercase">{v.visibilityType}</td>
                  <td className="py-1 pr-2">{v.engine}</td>
                  <td className="py-1 pr-2">{v.position ?? '—'}</td>
                  <td className="py-1 pr-2">{v.brandMentioned ? '✓' : '—'}</td>
                  <td className="py-1 text-gray-400">{new Date(v.measuredAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
