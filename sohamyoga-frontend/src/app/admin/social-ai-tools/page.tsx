'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'AI Copy Studio' | 'AI Image Prompts' | 'TikTok Ads' | 'Influencer Discovery' | 'Community Manager';
const TABS: Tab[] = ['AI Copy Studio', 'AI Image Prompts', 'TikTok Ads', 'Influencer Discovery', 'Community Manager'];

interface CopyRequest { id: number; platform: string; tone: string; topic: string; target_audience: string; generated_copy: string; status: string; performance_score: number; created_at: string; }
interface CommunityMember { id: number; platform: string; handle: string; engagement_level: string; tags: string[]; notes: string; }
interface TikTokAd { id: number; campaign_name: string; ad_format: string; budget: number; hook: string; cta: string; status: string; impressions: number; clicks: number; }
interface InfluencerProfile { id: number; handle: string; platform: string; niche: string; followers: number; engagement_rate: number; status: string; ai_match_score: number; }

const STATUS_COLOR: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', published: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700', active: 'bg-green-100 text-green-700', partner: 'bg-purple-100 text-purple-700', discovered: 'bg-yellow-100 text-yellow-700', contacted: 'bg-blue-100 text-blue-700', 'in-negotiation': 'bg-orange-100 text-orange-700' };
const ENG_COLOR: Record<string, string> = { high: 'bg-green-100 text-green-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-red-100 text-red-700' };

export default function SocialAIToolsPage() {
  const [tab, setTab] = useState<Tab>('AI Copy Studio');
  const [copies, setCopies] = useState<CopyRequest[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [tiktokAds, setTiktokAds] = useState<TikTokAd[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [stats, setStats] = useState<{ total: string; avg_score: string }>({ total: '0', avg_score: '0' });
  const [loading, setLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<Record<string, unknown> | null>(null);

  // Copy form
  const [copyForm, setCopyForm] = useState({ platform: 'instagram', tone: 'inspirational', topic: '', target_audience: '' });
  // Image prompt form
  const [imgForm, setImgForm] = useState({ topic: '', style: 'lifestyle photography', platform: 'instagram' });
  const [imgPrompts, setImgPrompts] = useState<{ prompt: string; negative_prompt: string; style_tags: string[] }[]>([]);
  // TikTok form
  const [tiktokForm, setTiktokForm] = useState({ product: '', target_audience: '', goal: 'brand awareness' });
  const [tiktokScript, setTiktokScript] = useState<Record<string, unknown> | null>(null);
  // Influencer discover form
  const [discoverForm, setDiscoverForm] = useState({ niche: 'yoga & wellness', audience: 'health enthusiasts', budget_range: '$500-2000', platform: 'instagram' });
  const [discoveredInfluencers, setDiscoveredInfluencers] = useState<unknown[]>([]);
  // Segment result
  const [segmentResult, setSegmentResult] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/admin/social-ai-tools');
    if (res.ok) {
      const data = await res.json() as { copies: CopyRequest[]; stats: { total: string; avg_score: string } };
      setCopies(data.copies || []);
      setStats(data.stats || { total: '0', avg_score: '0' });
    }
    const [mRes, tRes, iRes] = await Promise.all([
      fetch('/api/admin/social-ai-tools/community'),
      fetch('/api/admin/social-ai-tools/tiktok'),
      fetch('/api/admin/social-ai-tools/influencers'),
    ]);
    if (mRes.ok) setMembers(await mRes.json() as CommunityMember[]);
    if (tRes.ok) setTiktokAds(await tRes.json() as TikTokAd[]);
    if (iRes.ok) setInfluencers(await iRes.json() as InfluencerProfile[]);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const generateCopy = async () => {
    if (!copyForm.topic) return;
    setLoading(true); setAiOutput(null);
    try {
      const res = await fetch('/api/admin/social-ai-tools/generate-copy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copyForm) });
      const data = await res.json() as Record<string, unknown>;
      setAiOutput(data);
      await fetch('/api/admin/social-ai-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...copyForm, generated_copy: data.copy as string }) });
      await loadData();
    } finally { setLoading(false); }
  };

  const generateImagePrompts = async () => {
    if (!imgForm.topic) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-ai-tools/generate-image-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imgForm) });
      const data = await res.json() as { prompts: { prompt: string; negative_prompt: string; style_tags: string[] }[] };
      setImgPrompts(data.prompts || []);
    } finally { setLoading(false); }
  };

  const generateTikTok = async () => {
    if (!tiktokForm.product) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-ai-tools/tiktok/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tiktokForm) });
      setTiktokScript(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  const discoverInfluencers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-ai-tools/influencers/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discoverForm) });
      const data = await res.json() as { influencers: unknown[] };
      setDiscoveredInfluencers(data.influencers || []);
    } finally { setLoading(false); }
  };

  const segmentCommunity = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-ai-tools/community/segment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      setSegmentResult(await res.json() as Record<string, unknown>);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-6 py-4">
        <h1 className="text-xl font-bold">Social AI Tools</h1>
        <p className="text-slate-300 text-sm">AI-powered copy, image prompts, TikTok ads, influencer discovery & community management</p>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b px-6 py-3 flex gap-8">
        <div><span className="text-2xl font-bold text-slate-800">{stats.total}</span><span className="text-gray-500 text-sm ml-1">Copies Generated</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{Number(stats.avg_score).toFixed(0)}</span><span className="text-gray-500 text-sm ml-1">Avg Score</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{influencers.length}</span><span className="text-gray-500 text-sm ml-1">Influencers</span></div>
        <div><span className="text-2xl font-bold text-slate-800">{members.length}</span><span className="text-gray-500 text-sm ml-1">Community Members</span></div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* AI Copy Studio */}
        {tab === 'AI Copy Studio' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Generate Copy</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Platform</label>
                  <select value={copyForm.platform} onChange={e => setCopyForm(p => ({ ...p, platform: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['twitter','instagram','linkedin','tiktok','facebook'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Tone</label>
                  <select value={copyForm.tone} onChange={e => setCopyForm(p => ({ ...p, tone: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['professional','inspirational','casual','educational','witty','motivational','energetic'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Topic</label>
                  <input value={copyForm.topic} onChange={e => setCopyForm(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. Morning yoga routine" className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Target Audience</label>
                  <input value={copyForm.target_audience} onChange={e => setCopyForm(p => ({ ...p, target_audience: e.target.value }))}
                    placeholder="e.g. Young professionals" className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                </div>
                <button onClick={generateCopy} disabled={loading || !copyForm.topic}
                  className="w-full bg-blue-600 text-white py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '✨ Generate with AI'}
                </button>
              </div>
              {aiOutput && (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs font-semibold text-blue-800 mb-1">Generated Copy</p>
                  <p className="text-sm text-gray-800 mb-2">{String(aiOutput.copy)}</p>
                  <p className="text-xs text-blue-700 font-medium">Hook: {String(aiOutput.hook)}</p>
                  <p className="text-xs text-gray-600 mt-1">CTA: {String(aiOutput.cta)}</p>
                  <div className="flex flex-wrap gap-1 mt-2">{(aiOutput.hashtags as string[] || []).map((h: string) => <span key={h} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{h}</span>)}</div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Copy History ({copies.length})</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {copies.map(c => (
                  <div key={c.id} className="border rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex gap-2">
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize">{c.platform}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded capitalize">{c.tone}</span>
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${STATUS_COLOR[c.status] || 'bg-gray-100'}`}>{c.status}</span>
                      </div>
                      {c.performance_score > 0 && <span className="text-xs font-bold text-green-700">{c.performance_score}/100</span>}
                    </div>
                    <p className="text-xs font-medium text-gray-700">{c.topic} → {c.target_audience}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.generated_copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Image Prompts */}
        {tab === 'AI Image Prompts' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Image Prompt Generator</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Topic</label>
                  <input value={imgForm.topic} onChange={e => setImgForm(p => ({ ...p, topic: e.target.value }))}
                    placeholder="e.g. Woman doing morning yoga" className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Style</label>
                  <select value={imgForm.style} onChange={e => setImgForm(p => ({ ...p, style: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['lifestyle photography','minimalist','editorial','cinematic','documentary','flat lay','product'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Platform</label>
                  <select value={imgForm.platform} onChange={e => setImgForm(p => ({ ...p, platform: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['instagram','facebook','tiktok','linkedin','twitter'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <button onClick={generateImagePrompts} disabled={loading || !imgForm.topic}
                  className="w-full bg-purple-600 text-white py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '🎨 Generate 3 Prompts'}
                </button>
              </div>
            </div>
            <div className="col-span-2 space-y-4">
              {imgPrompts.length === 0 && <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Enter a topic and click Generate to create image prompts</div>}
              {imgPrompts.map((p, i) => (
                <div key={i} className="bg-white rounded-lg border p-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-700">Prompt {i + 1}</span>
                    <div className="flex gap-1">{(p.style_tags || []).map(t => <span key={t} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{t}</span>)}</div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 mb-2">
                    <p className="text-sm text-gray-800 font-mono text-xs leading-relaxed">{p.prompt}</p>
                  </div>
                  {p.negative_prompt && (
                    <div className="bg-red-50 rounded p-2">
                      <span className="text-xs font-medium text-red-700">Negative: </span>
                      <span className="text-xs text-red-600">{p.negative_prompt}</span>
                    </div>
                  )}
                  <button onClick={() => navigator.clipboard.writeText(p.prompt)}
                    className="mt-2 text-xs text-blue-600 hover:underline">Copy Prompt</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TikTok Ads */}
        {tab === 'TikTok Ads' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">TikTok Ad Generator</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Product / Service</label>
                  <input value={tiktokForm.product} onChange={e => setTiktokForm(p => ({ ...p, product: e.target.value }))}
                    placeholder="e.g. Online yoga classes" className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Target Audience</label>
                  <input value={tiktokForm.target_audience} onChange={e => setTiktokForm(p => ({ ...p, target_audience: e.target.value }))}
                    placeholder="e.g. Women 25-35 interested in wellness" className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Goal</label>
                  <select value={tiktokForm.goal} onChange={e => setTiktokForm(p => ({ ...p, goal: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['brand awareness','website traffic','app installs','conversions','video views'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <button onClick={generateTikTok} disabled={loading || !tiktokForm.product}
                  className="w-full bg-red-600 text-white py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {loading ? 'Generating...' : '🎵 Generate TikTok Ad'}
                </button>
              </div>
              {tiktokScript && (
                <div className="mt-4 space-y-2">
                  <div className="bg-red-50 rounded p-3 border border-red-200">
                    <p className="text-xs font-bold text-red-800">3-Second Hook</p>
                    <p className="text-sm mt-1">{String(tiktokScript.hook)}</p>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-xs font-bold text-gray-700">Script</p>
                    <p className="text-xs mt-1 whitespace-pre-line">{String(tiktokScript.script)}</p>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-xs font-bold text-green-800">CTA: {String(tiktokScript.cta)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">TikTok Campaigns ({tiktokAds.length})</h2>
              <div className="space-y-3">
                {tiktokAds.map(ad => (
                  <div key={ad.id} className="border rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-sm text-slate-800">{ad.campaign_name}</p>
                        <p className="text-xs text-gray-500">{ad.ad_format} · Budget: ${Number(ad.budget).toLocaleString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[ad.status] || 'bg-gray-100'}`}>{ad.status}</span>
                    </div>
                    {ad.hook && <p className="text-xs text-gray-700 mt-2 italic">Hook: &quot;{ad.hook}&quot;</p>}
                    {ad.impressions > 0 && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>{ad.impressions.toLocaleString()} impressions</span>
                        <span>{ad.clicks.toLocaleString()} clicks</span>
                        <span className="text-green-600 font-medium">{ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0}% CTR</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Influencer Discovery */}
        {tab === 'Influencer Discovery' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">AI Influencer Finder</h2>
              <div className="space-y-3">
                {(['niche','audience','budget_range'] as const).map(k => (
                  <div key={k}>
                    <label className="text-xs font-medium text-gray-600 capitalize">{k.replace('_', ' ')}</label>
                    <input value={discoverForm[k]} onChange={e => setDiscoverForm(p => ({ ...p, [k]: e.target.value }))}
                      className="w-full mt-1 border rounded px-3 py-2 text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-600">Platform</label>
                  <select value={discoverForm.platform} onChange={e => setDiscoverForm(p => ({ ...p, platform: e.target.value }))}
                    className="w-full mt-1 border rounded px-3 py-2 text-sm">
                    {['instagram','tiktok','youtube','facebook','linkedin'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <button onClick={discoverInfluencers} disabled={loading}
                  className="w-full bg-orange-600 text-white py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                  {loading ? 'Discovering...' : '🔍 Discover with AI'}
                </button>
              </div>
            </div>
            <div className="col-span-2 space-y-3">
              <h2 className="font-semibold text-slate-800">Your Influencer Database ({influencers.length})</h2>
              {influencers.map(inf => (
                <div key={inf.id} className="bg-white border rounded p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inf.handle} <span className="text-xs text-gray-400">· {inf.platform}</span></p>
                    <p className="text-xs text-gray-500">{inf.niche} · {Number(inf.followers).toLocaleString()} followers · {inf.engagement_rate}% ER</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-700">{inf.ai_match_score}</div>
                      <div className="text-xs text-gray-500">Match Score</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLOR[inf.status] || 'bg-gray-100'}`}>{inf.status}</span>
                  </div>
                </div>
              ))}
              {discoveredInfluencers.length > 0 && (
                <>
                  <h3 className="font-medium text-slate-700 mt-4">AI Discovered Influencers</h3>
                  {(discoveredInfluencers as Record<string, unknown>[]).map((inf, i) => (
                    <div key={i} className="bg-orange-50 border border-orange-200 rounded p-4">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium text-sm">{String(inf.handle)} <span className="text-xs text-gray-400">· {String(inf.platform)}</span></p>
                          <p className="text-xs text-gray-600">{String(inf.niche_alignment)}</p>
                          <p className="text-xs text-gray-500 mt-1">~{Number(inf.estimated_followers).toLocaleString()} followers · {String(inf.estimated_engagement_rate)}% ER</p>
                        </div>
                        <span className="text-xl font-bold text-orange-700">{String(inf.match_score)}</span>
                      </div>
                      <p className="text-xs text-blue-700 mt-2 italic">Tip: {String(inf.outreach_tip)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Community Manager */}
        {tab === 'Community Manager' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Community Segmentation</h2>
              <button onClick={segmentCommunity} disabled={loading}
                className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 mb-4">
                {loading ? 'Analyzing...' : '🤖 AI Segment Community'}
              </button>
              {segmentResult && (
                <div className="space-y-3">
                  {Object.entries(segmentResult.segments as Record<string, { count: number; tactics: string[] }>).map(([seg, data]) => (
                    <div key={seg} className={`rounded p-3 ${seg === 'high_value' ? 'bg-green-50 border border-green-200' : seg === 'medium_value' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
                      <p className="text-xs font-semibold capitalize">{seg.replace('_', ' ')} ({data.count})</p>
                      <ul className="mt-1 space-y-1">{data.tactics.map((t: string) => <li key={t} className="text-xs text-gray-700">• {t}</li>)}</ul>
                    </div>
                  ))}
                  {(segmentResult.recommended_campaigns as string[])?.length > 0 && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs font-semibold text-blue-800">Recommended Campaigns</p>
                      {(segmentResult.recommended_campaigns as string[]).map((c: string) => <p key={c} className="text-xs text-blue-700">• {c}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2 bg-white rounded-lg border p-5">
              <h2 className="font-semibold text-slate-800 mb-4">Community Members ({members.length})</h2>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="border rounded p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{m.handle} <span className="text-xs text-gray-400">· {m.platform}</span></p>
                      {m.notes && <p className="text-xs text-gray-500">{m.notes}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">{(m.tags || []).map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>)}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${ENG_COLOR[m.engagement_level] || 'bg-gray-100'}`}>{m.engagement_level}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
