'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandAsset {
  id: number; asset_type: string; name: string; hex_color: string | null;
  font_family: string | null; usage_notes: string; is_primary: boolean; file_url: string | null;
}

interface BrandGuideline {
  id: number; section: string; title: string; content: string;
  do_examples: string; dont_examples: string;
}

interface BrandMention {
  id: number; platform: string; mention_text: string; sentiment: string;
  reach_estimate: number; author: string; mentioned_at: string; reviewed: boolean;
}

interface VoiceCheckResult {
  score: number; tone: string; formality: string; brand_alignment: string;
  suggestions: string[];
}

interface BrandScore {
  consistency: number; clarity: number; differentiation: number;
  emotional_appeal: number; market_fit: number; digital_presence: number;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function sentimentColor(s: string) {
  if (s === 'positive') return 'bg-green-100 text-green-700';
  if (s === 'negative') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function assetTypeColor(t: string) {
  const m: Record<string, string> = {
    color: 'bg-pink-100 text-pink-700', font: 'bg-blue-100 text-blue-700',
    logo: 'bg-indigo-100 text-indigo-700', icon: 'bg-yellow-100 text-yellow-700',
    photo: 'bg-green-100 text-green-700', template: 'bg-purple-100 text-purple-700',
  };
  return m[t] ?? 'bg-gray-100 text-gray-600';
}

const COMPETITOR_BRANDS = [
  { name: 'Mindbody', colors: '#4F46E5 / #FFFFFF', tone: 'Professional, trustworthy', positioning: 'B2B platform for wellness businesses', differentiator: 'Scale & integrations' },
  { name: 'ClassPass', colors: '#FF6B6B / #FFFFFF', tone: 'Fun, energetic, social', positioning: 'Flexible fitness discovery for consumers', differentiator: 'Variety & credit flexibility' },
  { name: 'Peloton', colors: '#CC0000 / #000000', tone: 'Premium, aspirational, intense', positioning: 'Connected fitness lifestyle brand', differentiator: 'Hardware + content flywheel' },
  { name: 'Down Dog', colors: '#2D3748 / #68D391', tone: 'Calm, approachable, adaptive', positioning: 'Smart yoga app for self-practice', differentiator: 'AI-adaptive sequencing UX' },
  { name: 'FitOn', colors: '#FF8C00 / #FFFFFF', tone: 'Inclusive, motivating, free-first', positioning: 'Accessible fitness for everyone', differentiator: 'Free tier + celebrity trainers' },
];

const TEMPLATE_CATEGORIES = [
  { name: 'Social Post', templates: ['Instagram Announcement: "{{EXCITING_NEWS}} — {{OFFER_DETAILS}}. Tap link in bio!"', 'Facebook Event: "Join us for {{CLASS_NAME}} on {{DATE}}. Spots limited!"'] },
  { name: 'Email', templates: ['Subject: {{FIRST_NAME}}, your {{CLASS_TYPE}} class is tomorrow', 'Re-engagement: "We miss you, {{FIRST_NAME}}! Here\'s {{DISCOUNT_PCT}}% off your next class"'] },
  { name: 'Blog', templates: ['How {{PRACTICE_NAME}} Can Help You {{BENEFIT}} in 30 Days', '{{NUMBER}} Things Every Beginner Should Know About {{TOPIC}}'] },
  { name: 'Press Release', templates: ['FOR IMMEDIATE RELEASE: {{COMPANY}} Launches {{PRODUCT}} to Help {{AUDIENCE}} {{ACHIEVE_GOAL}}'] },
  { name: 'Ad Copy', templates: ['{{PAIN_POINT}}? {{COMPANY}} helps {{AUDIENCE}} {{SOLUTION}} — {{CTA}}.', '{{NUMBER}}+ {{AUDIENCE}} already use {{PRODUCT}} to {{BENEFIT}}.'] },
  { name: 'Product Description', templates: ['{{PRODUCT_NAME}}: {{PRIMARY_BENEFIT}} for {{TARGET_AUDIENCE}}. {{FEATURE_1}}, {{FEATURE_2}}, and {{FEATURE_3}}. {{CTA}}.'] },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BrandingPage() {
  const [tab, setTab] = useState(0);
  const [seedMsg, setSeedMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/branding/seed', { method: 'POST' })
      .then(r => r.json())
      .then((d: { message?: string }) => setSeedMsg(d.message ?? 'Database ready.'))
      .catch(() => setSeedMsg('Ready.'));
  }, []);

  const tabs = [
    'Brand Identity', 'Brand Guidelines', 'Asset Library', 'Brand Voice',
    'Brand Monitoring', 'Competitor Branding', 'Content Templates', 'Brand Score',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Branding Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Brand identity, voice, guidelines, assets, and competitive positioning</p>
          {seedMsg && <p className="text-xs text-green-600 mt-1">{seedMsg}</p>}
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-0 overflow-x-auto">
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === i ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === 0 && <TabBrandIdentity />}
        {tab === 1 && <TabBrandGuidelines />}
        {tab === 2 && <TabAssetLibrary />}
        {tab === 3 && <TabBrandVoice />}
        {tab === 4 && <TabBrandMonitoring />}
        {tab === 5 && <TabCompetitorBranding />}
        {tab === 6 && <TabContentTemplates />}
        {tab === 7 && <TabBrandScore />}
      </div>
    </div>
  );
}

// ── Tab 1: Brand Identity ─────────────────────────────────────────────────────

function TabBrandIdentity() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddColor, setShowAddColor] = useState(false);
  const [form, setForm] = useState({ name: '', hex_color: '#4F46E5', is_primary: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/branding/assets')
      .then(r => r.json())
      .then((d: { assets?: BrandAsset[] }) => setAssets(d.assets ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const colors = assets.filter(a => a.asset_type === 'color');
  const fonts = assets.filter(a => a.asset_type === 'font');
  const logos = assets.filter(a => a.asset_type === 'logo');

  const handleAddColor = async () => {
    if (!form.name.trim()) return;
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/admin/branding/assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, asset_type: 'color' }),
      });
      if (!r.ok) throw new Error('Failed');
      setMsg('Color added!'); setShowAddColor(false);
      setForm({ name: '', hex_color: '#4F46E5', is_primary: false });
      load();
    } catch { setMsg('Error adding color.'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-8">
      {/* Color Swatches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Brand Colors</h2>
          <button onClick={() => setShowAddColor(v => !v)} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
            + Add Color
          </button>
        </div>
        {msg && <p className="text-sm text-green-600 mb-3">{msg}</p>}
        {showAddColor && (
          <div className="bg-white border border-indigo-200 rounded-lg p-4 mb-4 flex gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="border border-gray-300 rounded px-3 py-2 text-sm" placeholder="e.g. Ocean Blue" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hex Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.hex_color} onChange={e => setForm(f => ({ ...f, hex_color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
                <input value={form.hex_color} onChange={e => setForm(f => ({ ...f, hex_color: e.target.value }))}
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-28" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_primary" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
              <label htmlFor="is_primary" className="text-sm text-gray-700">Primary</label>
            </div>
            <button onClick={handleAddColor} disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        )}
        {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
          <div className="flex gap-4 flex-wrap">
            {colors.map(c => (
              <div key={c.id} className="flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-xl shadow-sm border border-gray-200"
                  style={{ backgroundColor: c.hex_color ?? '#ccc' }} />
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-400 font-mono">{c.hex_color}</div>
                  {c.is_primary && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Primary</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Typography */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Typography</h2>
        <div className="grid grid-cols-3 gap-4">
          {fonts.map(f => (
            <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl mb-2" style={{ fontFamily: f.name }}>{f.name}</div>
              <div className="text-xs text-gray-500">{f.usage_notes}</div>
              {f.is_primary && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded mt-2 inline-block">Primary</span>}
            </div>
          ))}
          {fonts.length === 0 && !loading && <div className="col-span-3 text-gray-400 text-sm">No fonts seeded yet.</div>}
        </div>
      </div>

      {/* Logos */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo Variants</h2>
        <div className="grid grid-cols-3 gap-4">
          {logos.map(l => (
            <div key={l.id} className={`border border-gray-200 rounded-lg p-6 flex items-center justify-center ${l.name.includes('Mono') ? 'bg-gray-900' : 'bg-white'}`}>
              <div className={`text-lg font-bold ${l.name.includes('Mono') ? 'text-white' : 'text-indigo-600'}`}>
                {l.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Brand Guidelines ───────────────────────────────────────────────────

function TabBrandGuidelines() {
  const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [genResult, setGenResult] = useState<Record<number, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/branding/guidelines')
      .then(r => r.json())
      .then((d: { guidelines?: BrandGuideline[] }) => setGuidelines(d.guidelines ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateSection = async (g: BrandGuideline) => {
    setGenerating(g.id);
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-guideline', section: g.section, title: g.title }),
      });
      const d = await r.json() as { result?: string; error?: string };
      setGenResult(prev => ({ ...prev, [g.id]: d.result ?? d.error ?? 'Generation failed' }));
    } catch (e) { setGenResult(prev => ({ ...prev, [g.id]: String(e) })); } finally { setGenerating(null); }
  };

  const sections = guidelines.length > 0 ? guidelines : [
    { id: 1, section: 'voice', title: 'Voice & Tone', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 2, section: 'visual', title: 'Visual Identity', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 3, section: 'messaging', title: 'Messaging', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 4, section: 'positioning', title: 'Positioning', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 5, section: 'values', title: 'Values', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 6, section: 'audience', title: 'Audience', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
    { id: 7, section: 'competitors', title: 'Competitors', content: 'No guideline yet.', do_examples: '', dont_examples: '' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Brand Guidelines</h2>
      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="space-y-3">
          {sections.map(g => (
            <div key={g.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left">
                <span className="font-semibold text-gray-900">{g.title}</span>
                <span className="text-gray-400">{expanded === g.id ? '▲' : '▼'}</span>
              </button>
              {expanded === g.id && (
                <div className="px-5 pb-5 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
                    <textarea defaultValue={g.content} rows={4}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  </div>
                  {g.do_examples && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="text-xs font-medium text-green-700 mb-1">Do Examples</div>
                        <p className="text-xs text-green-800">{g.do_examples}</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="text-xs font-medium text-red-700 mb-1">Don&apos;t Examples</div>
                        <p className="text-xs text-red-800">{g.dont_examples}</p>
                      </div>
                    </div>
                  )}
                  <button onClick={() => handleGenerateSection(g)} disabled={generating === g.id}
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
                    {generating === g.id ? 'Generating with AI…' : 'AI Generate'}
                  </button>
                  {genResult[g.id] && (
                    <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-purple-800 whitespace-pre-wrap">
                      {genResult[g.id]}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Asset Library ──────────────────────────────────────────────────────

function TabAssetLibrary() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', asset_type: 'logo', hex_color: '', usage_notes: '', is_primary: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const url = typeFilter ? `/api/admin/branding/assets?type=${typeFilter}` : '/api/admin/branding/assets';
    fetch(url).then(r => r.json())
      .then((d: { assets?: BrandAsset[] }) => setAssets(d.assets ?? []))
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/admin/branding/assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setShowAdd(false); load();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const types = ['logo', 'color', 'font', 'icon', 'photo', 'template'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${!typeFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            All
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700">
          + Add Asset
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-indigo-200 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">New Brand Asset</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={form.asset_type} onChange={e => setForm(f => ({ ...f, asset_type: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                {types.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hex Color</label>
              <input value={form.hex_color} onChange={e => setForm(f => ({ ...f, hex_color: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="#4F46E5" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Usage Notes</label>
              <input value={form.usage_notes} onChange={e => setForm(f => ({ ...f, usage_notes: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} />
              <label className="text-sm text-gray-700">Primary asset</label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Asset'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map(a => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
              {a.hex_color && (
                <div className="w-full h-12 rounded" style={{ backgroundColor: a.hex_color }} />
              )}
              <div className="font-medium text-gray-900 text-xs">{a.name}</div>
              <div className="flex gap-1 flex-wrap">
                <span className={`text-xs px-1.5 py-0.5 rounded ${assetTypeColor(a.asset_type)}`}>{a.asset_type}</span>
                {a.is_primary && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Primary</span>}
              </div>
              {a.usage_notes && <div className="text-xs text-gray-400">{a.usage_notes}</div>}
            </div>
          ))}
          {assets.length === 0 && <div className="col-span-full text-center py-8 text-gray-400 text-sm">No assets found.</div>}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Brand Voice ────────────────────────────────────────────────────────

function TabBrandVoice() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<VoiceCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [taglines, setTaglines] = useState<string[]>([]);
  const [genTaglines, setGenTaglines] = useState(false);
  const [audience, setAudience] = useState('health-conscious adults 25-45');

  const handleCheck = async () => {
    if (!text.trim()) return;
    setChecking(true); setResult(null);
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-voice', text }),
      });
      const d = await r.json() as { result?: VoiceCheckResult; score?: number; tone?: string; formality?: string; brand_alignment?: string; suggestions?: string[] };
      setResult(d.result ?? (d.score !== undefined ? d as unknown as VoiceCheckResult : null));
    } catch (e) { console.error(e); } finally { setChecking(false); }
  };

  const handleGenTaglines = async () => {
    setGenTaglines(true); setTaglines([]);
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-tagline', audience }),
      });
      const d = await r.json() as { taglines?: string[]; result?: { taglines?: string[] } };
      setTaglines(d.taglines ?? d.result?.taglines ?? []);
    } catch { /* ignore */ } finally { setGenTaglines(false); }
  };

  return (
    <div className="space-y-8">
      {/* Voice Analysis */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Brand Voice Analyzer</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Paste text to analyze</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={8}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                placeholder="Paste a caption, email, blog excerpt, ad copy…" />
            </div>
            <button onClick={handleCheck} disabled={checking || !text.trim()}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
              {checking ? 'Analyzing with AI…' : 'Analyze Brand Voice'}
            </button>
          </div>
          {result && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Analysis Result</h3>
                <div className={`text-2xl font-bold ${result.score >= 80 ? 'text-green-600' : result.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {result.score}/100
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Tone', value: result.tone },
                  { label: 'Formality', value: result.formality },
                  { label: 'Brand Alignment', value: result.brand_alignment },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded p-2">
                    <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                    <div className="text-sm font-medium text-gray-900">{item.value}</div>
                  </div>
                ))}
              </div>
              {result.suggestions?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">Suggestions</div>
                  <ul className="space-y-1">
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="text-indigo-500">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sample Library */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Library — AI Tagline Generator</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Target Audience</label>
              <input value={audience} onChange={e => setAudience(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <button onClick={handleGenTaglines} disabled={genTaglines}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
              {genTaglines ? 'Generating…' : 'Generate Taglines'}
            </button>
          </div>
          {taglines.length > 0 && (
            <div className="space-y-2">
              {taglines.map((t, i) => (
                <div key={i} className="bg-indigo-50 border border-indigo-200 rounded px-4 py-3 text-sm font-medium text-indigo-900">
                  &ldquo;{t}&rdquo;
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 5: Brand Monitoring ───────────────────────────────────────────────────

function TabBrandMonitoring() {
  const [mentions, setMentions] = useState<BrandMention[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/branding/mentions')
      .then(r => r.json())
      .then((d: { mentions?: BrandMention[] }) => setMentions(d.mentions ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const positive = mentions.filter(m => m.sentiment === 'positive').length;
  const negative = mentions.filter(m => m.sentiment === 'negative').length;
  const neutral = mentions.filter(m => m.sentiment === 'neutral').length;

  const handleToggleReviewed = async (id: number, reviewed: boolean) => {
    await fetch(`/api/admin/branding/mentions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: !reviewed }),
    }).catch(() => {});
    load();
  };

  return (
    <div className="space-y-6">
      {/* Sentiment KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Positive', value: positive, color: 'text-green-600' },
          { label: 'Neutral', value: neutral, color: 'text-gray-600' },
          { label: 'Negative', value: negative, color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={`text-3xl font-bold ${k.color}`}>{loading ? '…' : k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label} Mentions</div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900">Brand Mentions</h2>
      {loading ? <div className="text-gray-400 text-sm">Loading…</div> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Platform', 'Mention', 'Sentiment', 'Reach', 'Author', 'Date', 'Reviewed'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mentions.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium">{m.platform}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{m.mention_text}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${sentimentColor(m.sentiment)}`}>{m.sentiment}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.reach_estimate?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{m.author}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{m.mentioned_at ? new Date(m.mentioned_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleReviewed(m.id, m.reviewed)}
                      className={`text-xs px-2 py-0.5 rounded ${m.reviewed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.reviewed ? 'Reviewed' : 'Mark Reviewed'}
                    </button>
                  </td>
                </tr>
              ))}
              {mentions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No mentions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 6: Competitor Branding ────────────────────────────────────────────────

function TabCompetitorBranding() {
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState('');

  const handleAnalyze = async () => {
    setGenerating(true); setAnalysis('');
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'differentiation-analysis',
          competitors: COMPETITOR_BRANDS.map(c => c.name).join(', '),
        }),
      });
      const d = await r.json() as { result?: string };
      setAnalysis(d.result ?? 'No analysis generated.');
    } catch (e) { setAnalysis(String(e)); } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Competitor Brand Comparison</h2>
        <button onClick={handleAnalyze} disabled={generating}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
          {generating ? 'Analyzing…' : 'AI Differentiation Analysis'}
        </button>
      </div>

      {analysis && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-900 whitespace-pre-wrap">{analysis}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Brand', 'Colors', 'Tone', 'Positioning', 'Differentiator'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPETITOR_BRANDS.map(b => (
              <tr key={b.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                <td className="px-4 py-3 text-xs text-gray-600 font-mono">{b.colors}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{b.tone}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{b.positioning}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{b.differentiator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab 7: Content Templates ──────────────────────────────────────────────────

function TabContentTemplates() {
  const [activeCategory, setActiveCategory] = useState(TEMPLATE_CATEGORIES[0].name);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState('');
  const [prompt, setPrompt] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true); setGenResult('');
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-template', category: activeCategory, prompt }),
      });
      const d = await r.json() as { result?: string };
      setGenResult(d.result ?? 'No template generated.');
    } catch (e) { setGenResult(String(e)); } finally { setGenerating(false); }
  };

  const active = TEMPLATE_CATEGORIES.find(c => c.name === activeCategory) ?? TEMPLATE_CATEGORIES[0];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Content Templates</h2>
      <div className="flex gap-2 flex-wrap">
        {TEMPLATE_CATEGORIES.map(c => (
          <button key={c.name} onClick={() => setActiveCategory(c.name)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${activeCategory === c.name ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {active.templates.map((t, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {t.split(/(\{\{[^}]+\}\})/).map((part, j) =>
                  part.startsWith('{{') ? (
                    <mark key={j} className="bg-yellow-100 text-yellow-800 rounded px-0.5">{part}</mark>
                  ) : part
                )}
              </pre>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 self-start">
          <h3 className="font-semibold text-gray-900 text-sm">Generate New Template</h3>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder={`Describe what you need for ${activeCategory}…`} />
          <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
            className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
            {generating ? 'Generating…' : 'Generate Template'}
          </button>
          {genResult && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono whitespace-pre-wrap">{genResult}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 8: Brand Score ────────────────────────────────────────────────────────

const SCORE_DIMENSIONS: Array<{ key: keyof BrandScore; label: string; desc: string }> = [
  { key: 'consistency', label: 'Consistency', desc: 'Visual and message consistency across all channels' },
  { key: 'clarity', label: 'Clarity', desc: 'How clearly we communicate our value proposition' },
  { key: 'differentiation', label: 'Differentiation', desc: 'How distinctly we stand out from competitors' },
  { key: 'emotional_appeal', label: 'Emotional Appeal', desc: 'Emotional connection with our target audience' },
  { key: 'market_fit', label: 'Market Fit', desc: 'Alignment of brand with market expectations' },
  { key: 'digital_presence', label: 'Digital Presence', desc: 'Online visibility, SEO, and social media strength' },
];

function TabBrandScore() {
  const [scores, setScores] = useState<BrandScore>({
    consistency: 7, clarity: 6, differentiation: 5,
    emotional_appeal: 8, market_fit: 7, digital_presence: 6,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState('');

  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 6);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/branding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-score', scores }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const handleRecommendations = async () => {
    setGenerating(true); setRecommendations('');
    try {
      const r = await fetch('/api/admin/branding/voice-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recommendations', scores, overall }),
      });
      const d = await r.json() as { result?: string };
      setRecommendations(d.result ?? 'No recommendations generated.');
    } catch (e) { setRecommendations(String(e)); } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Brand Score Dashboard</h2>
        <div className="flex items-center gap-3">
          <div className={`text-4xl font-bold ${overall >= 8 ? 'text-green-600' : overall >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>
            {overall}<span className="text-lg text-gray-400">/10</span>
          </div>
          <div className="text-sm text-gray-500">Overall Score</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SCORE_DIMENSIONS.map(dim => (
          <div key={dim.key} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900 text-sm">{dim.label}</div>
                <div className="text-xs text-gray-500">{dim.desc}</div>
              </div>
              <input
                type="number" min={1} max={10}
                value={scores[dim.key]}
                onChange={e => setScores(s => ({ ...s, [dim.key]: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm font-bold"
              />
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${scores[dim.key] >= 8 ? 'bg-green-500' : scores[dim.key] >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${scores[dim.key] * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Scores'}
        </button>
        <button onClick={handleRecommendations} disabled={generating}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50">
          {generating ? 'Generating…' : 'AI Recommendations'}
        </button>
      </div>

      {recommendations && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 text-sm text-purple-900 whitespace-pre-wrap">
          {recommendations}
        </div>
      )}
    </div>
  );
}
