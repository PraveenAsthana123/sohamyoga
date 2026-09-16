'use client';
import { useEffect, useState, useCallback } from 'react';

type Tab = 'pages' | 'seo' | 'copy-generator' | 'settings';

interface WebsitePage {
  id: number;
  slug: string;
  title: string;
  section: string;
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  last_published: string | null;
  created_at: string;
}

const SECTIONS = ['hero', 'about', 'services', 'pricing', 'testimonials', 'blog', 'contact', 'portfolio', 'team', 'faq'];
const TONES = ['professional', 'casual', 'bold'];
const COPY_SECTIONS = ['hero', 'about', 'services', 'pricing', 'testimonials', 'cta'];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
};

export default function AgencyWebsitePage() {
  const [tab, setTab] = useState<Tab>('pages');
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [loading, setLoading] = useState(true);

  // Add page modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [pageForm, setPageForm] = useState({ slug: '', title: '', section: 'hero' });

  // SEO inline edit
  const [seoEdits, setSeoEdits] = useState<Record<number, { seo_title: string; seo_description: string }>>({});

  // Copy Generator
  const [copySection, setCopySection] = useState('hero');
  const [copyTone, setCopyTone] = useState('professional');
  const [copyKeywords, setCopyKeywords] = useState('');
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);

  // Settings
  const [settings, setSettings] = useState({ agencyName: 'Sohamyoga Marketing', tagline: 'Grow Your Business Online', contact: 'hello@sohamyoga.com', primaryColor: '#2563eb' });

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/agency-website');
      const d = await r.json();
      setPages(d.pages || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleAddPage = async () => {
    if (!pageForm.slug || !pageForm.title) return;
    await fetch('/api/admin/agency-website', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageForm),
    });
    setShowAddModal(false);
    setPageForm({ slug: '', title: '', section: 'hero' });
    fetchPages();
  };

  const handlePublish = async (slug: string) => {
    await fetch(`/api/admin/agency-website/${slug}/publish`, { method: 'POST' });
    fetchPages();
  };

  const handleSeoSave = async (page: WebsitePage) => {
    const edits = seoEdits[page.id];
    if (!edits) return;
    await fetch(`/api/admin/agency-website/${page.slug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seo_title: edits.seo_title, seo_description: edits.seo_description }),
    });
    setSeoEdits(e => { const n = { ...e }; delete n[page.id]; return n; });
    fetchPages();
  };

  const handleGenerateCopy = async () => {
    setCopyLoading(true);
    setGeneratedCopy('');
    try {
      const r = await fetch('/api/admin/agency-website/generate-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: copySection, tone: copyTone, keywords: copyKeywords }),
      });
      const d = await r.json();
      setGeneratedCopy(d.copy || d.error || 'No response');
    } catch {
      setGeneratedCopy('Failed to connect to API');
    } finally {
      setCopyLoading(false);
    }
  };

  const TAB_LABELS: Record<Tab, string> = { pages: 'Pages', seo: 'SEO', 'copy-generator': 'Copy Generator', settings: 'Settings' };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agency Website OS</h1>
            <p className="text-gray-500 text-sm mt-1">Manage pages, SEO, and copy for your agency website</p>
          </div>
          {tab === 'pages' && (
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + Add Page
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Pages Tab */}
        {tab === 'pages' && (
          loading ? (
            <div className="text-center py-16 text-gray-400">Loading...</div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Title', 'Slug', 'Section', 'Status', 'Last Published', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400">No pages yet. Click "Add Page" to create your first page.</td></tr>
                  )}
                  {pages.map(page => (
                    <tr key={page.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{page.title}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{page.slug}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{page.section}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[page.status] || 'bg-gray-100 text-gray-700'}`}>{page.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {page.last_published ? new Date(page.last_published).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {page.status !== 'published' && (
                          <button onClick={() => handlePublish(page.slug)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium">
                            Publish
                          </button>
                        )}
                        {page.status === 'published' && (
                          <span className="text-xs text-gray-400">Live</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* SEO Tab */}
        {tab === 'seo' && (
          <div className="space-y-3">
            {pages.map(page => {
              const edits = seoEdits[page.id] || { seo_title: page.seo_title || '', seo_description: page.seo_description || '' };
              const isDirty = seoEdits[page.id] !== undefined;
              return (
                <div key={page.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{page.title}</span>
                      <span className="ml-2 text-gray-400 text-xs font-mono">/{page.slug}</span>
                    </div>
                    {isDirty && (
                      <button onClick={() => handleSeoSave(page)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save SEO</button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">SEO Title (max 60 chars)</label>
                      <input
                        value={edits.seo_title}
                        onChange={e => setSeoEdits(s => ({ ...s, [page.id]: { ...edits, seo_title: e.target.value } }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                        placeholder="Page SEO title..."
                        maxLength={70}
                      />
                      <div className="text-xs text-gray-400 mt-0.5 text-right">{edits.seo_title.length}/60</div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Meta Description (max 160 chars)</label>
                      <textarea
                        value={edits.seo_description}
                        onChange={e => setSeoEdits(s => ({ ...s, [page.id]: { ...edits, seo_description: e.target.value } }))}
                        rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                        placeholder="Page meta description..."
                        maxLength={180}
                      />
                      <div className="text-xs text-gray-400 mt-0.5 text-right">{edits.seo_description.length}/160</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {pages.length === 0 && (
              <div className="text-center py-16 text-gray-400">No pages yet. Create pages in the Pages tab first.</div>
            )}
          </div>
        )}

        {/* Copy Generator Tab */}
        {tab === 'copy-generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Generate Website Copy</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <select value={copySection} onChange={e => setCopySection(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {COPY_SECTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                  <div className="flex gap-2">
                    {TONES.map(t => (
                      <button
                        key={t}
                        onClick={() => setCopyTone(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${copyTone === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (optional)</label>
                  <input
                    value={copyKeywords}
                    onChange={e => setCopyKeywords(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="digital marketing, ROI, growth..."
                  />
                </div>
                <button
                  onClick={handleGenerateCopy}
                  disabled={copyLoading}
                  className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  {copyLoading ? 'Generating copy...' : 'Generate Copy with AI'}
                </button>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Generated Copy</h2>
                {generatedCopy && (
                  <button onClick={() => navigator.clipboard.writeText(generatedCopy)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Copy</button>
                )}
              </div>
              {copyLoading ? (
                <div className="flex items-center justify-center h-48 text-gray-400">
                  <div className="text-center">
                    <div className="animate-pulse text-2xl mb-2">...</div>
                    <div className="text-sm">AI is writing your copy</div>
                  </div>
                </div>
              ) : generatedCopy ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{generatedCopy}</pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  Configure options and click Generate
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-lg">
            <h2 className="font-semibold text-gray-900 mb-4">Agency Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name</label>
                <input value={settings.agencyName} onChange={e => setSettings(s => ({ ...s, agencyName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                <input value={settings.tagline} onChange={e => setSettings(s => ({ ...s, tagline: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input type="email" value={settings.contact} onChange={e => setSettings(s => ({ ...s, contact: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={settings.primaryColor} onChange={e => setSettings(s => ({ ...s, primaryColor: e.target.value }))} className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                  <input value={settings.primaryColor} onChange={e => setSettings(s => ({ ...s, primaryColor: e.target.value }))} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <button className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Page Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add Page</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page Title *</label>
                <input value={pageForm.title} onChange={e => setPageForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Home" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input value={pageForm.slug} onChange={e => setPageForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" placeholder="home" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <select value={pageForm.section} onChange={e => setPageForm(f => ({ ...f, section: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleAddPage} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Create Page</button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
