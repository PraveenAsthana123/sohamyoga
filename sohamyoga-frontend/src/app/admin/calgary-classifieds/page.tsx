'use client';
import { useEffect, useState, useCallback } from 'react';

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'kijiji',              name: 'Kijiji',              emoji: '🟡', category: 'general',     post_url: 'https://www.kijiji.ca/p-post-ad.html',              avg_days: 30 },
  { id: 'craigslist',          name: 'Craigslist Calgary',  emoji: '🟢', category: 'general',     post_url: 'https://calgary.craigslist.org/post',               avg_days: 7  },
  { id: 'facebook_marketplace',name: 'Facebook Marketplace',emoji: '🔵', category: 'general',     post_url: 'https://www.facebook.com/marketplace/create/item',   avg_days: 30 },
  { id: 'usedcalgary',         name: 'UsedCalgary.com',     emoji: '🟠', category: 'general',     post_url: 'https://www.usedcalgary.com/post-ad',               avg_days: 30 },
  { id: 'calgary_herald',      name: 'Calgary Herald',      emoji: '📰', category: 'general',     post_url: 'https://classifieds.calgaryherald.com',             avg_days: 30 },
  { id: 'zumper',              name: 'Zumper Calgary',      emoji: '🏠', category: 'rentals',     post_url: 'https://www.zumper.com/list-your-rental',           avg_days: 60 },
  { id: 'autotrader',          name: 'AutoTrader.ca',       emoji: '🚗', category: 'vehicles',    post_url: 'https://www.autotrader.ca/a/SellYourCar',           avg_days: 90 },
  { id: 'realtor_ca',          name: 'Realtor.ca',          emoji: '🏡', category: 'real_estate', post_url: 'https://www.realtor.ca/sell',                       avg_days: 90 },
  { id: 'oodle',               name: 'Oodle Canada',        emoji: '🔍', category: 'general',     post_url: 'https://oodle.ca/classifieds/post',                 avg_days: 30 },
  { id: 'indeed',              name: 'Indeed Calgary',      emoji: '💼', category: 'jobs',        post_url: 'https://ca.indeed.com/hire/post-job',              avg_days: 30 },
];

const CATEGORIES = ['real_estate','vehicles','jobs','services','for_sale','rentals','pets','community'];
const NEIGHBOURHOODS = ['NW','NE','SW','SE','Downtown','Beltline','Airdrie','Cochrane','Okotoks','Other'];
const STATUSES = ['draft','active','paused','sold','expired'];
const LEAD_STATUSES = ['new','contacted','qualified','converted','lost'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlatformStatus {
  platform: string; status: string; platform_url: string | null;
  platform_ad_id: string | null; posted_at: string | null; expires_at: string | null;
  views_count: number; responses_count: number; notes: string | null;
}
interface Listing {
  id: number; title: string; category: string; subcategory: string | null;
  price: string | null; price_type: string; description: string | null;
  location: string; neighbourhood: string | null; images: string[] | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  status: string; tags: string[] | null; created_at: string;
  platform_statuses: PlatformStatus[];
}
interface Lead {
  id: number; listing_id: number; platform: string | null; name: string | null;
  email: string | null; phone: string | null; message: string | null;
  status: string; created_at: string; listing_title?: string;
}
interface Stats {
  total_listings: number; by_status: Record<string,number>; by_category: {category:string;count:number}[];
  by_neighbourhood: {neighbourhood:string;count:number}[];
  platform_coverage: {platform:string;posted:number;pending:number;failed:number}[];
  total_leads: number; leads_by_platform: {platform:string;count:number}[];
  best_performing: {listing_title:string;total_views:number;total_responses:number} | null;
}

type Tab = 'command' | 'listings' | 'tracker' | 'copy-studio' | 'leads';

// ── Helpers ───────────────────────────────────────────────────────────────────
function platformDot(status: string) {
  if (status === 'posted') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'expired') return 'bg-gray-400';
  return 'bg-yellow-400';
}
function platformById(id: string) { return PLATFORMS.find(p => p.id === id); }
function fmt(n: number | string | null | undefined) { if (n == null) return '—'; return String(n); }
function fmtPrice(price: string | null, price_type: string) {
  if (!price) return price_type === 'free' ? 'Free' : 'Contact';
  return `$${Number(price).toLocaleString()} (${price_type})`;
}
function categoryBadge(cat: string) {
  const colors: Record<string,string> = {
    real_estate:'bg-blue-100 text-blue-800', vehicles:'bg-slate-100 text-slate-800',
    jobs:'bg-purple-100 text-purple-800', services:'bg-orange-100 text-orange-800',
    for_sale:'bg-green-100 text-green-800', rentals:'bg-teal-100 text-teal-800',
    pets:'bg-pink-100 text-pink-800', community:'bg-yellow-100 text-yellow-800',
  };
  return colors[cat] ?? 'bg-gray-100 text-gray-800';
}

// ── Platform copy tips ────────────────────────────────────────────────────────
const PLATFORM_TIPS: Record<string,string> = {
  kijiji: '250-350 words. Friendly Canadian tone. Bullet points for features. Mention Calgary area.',
  craigslist: '150-200 words. Plain text only. No HTML. Concise and factual.',
  facebook_marketplace: '100-150 words. Conversational. 2-3 emojis ok. Community-friendly.',
  usedcalgary: '200-280 words. Local Calgary focus. Describe condition clearly.',
  calgary_herald: '150-250 words. Newspaper style. Professional, concise.',
  zumper: '180-250 words. Rental-focused. Highlight amenities and transit.',
  autotrader: 'Specs-focused. Include condition, mileage context, maintenance history.',
  realtor_ca: '200-280 words. MLS-style. Property details + neighbourhood highlights.',
  oodle: '180-250 words. Keyword-rich for aggregator search. Calgary context.',
  indeed: '200-300 words. Job posting format. Bullets for responsibilities + qualifications.',
};

// ── Modal: Create/Edit Listing ────────────────────────────────────────────────
function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(PLATFORMS.map(p => p.id));
  const [form, setForm] = useState({
    title: '', category: 'for_sale', subcategory: '', price: '', price_type: 'fixed',
    description: '', neighbourhood: 'NW', contact_name: '', contact_email: '',
    contact_phone: '', images: '', tags: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const generateDesc = async () => {
    if (!form.title) return;
    setGeneratingCopy(true);
    try {
      const res = await fetch('/api/admin/calgary-classifieds/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, category: form.category, price: form.price, neighbourhood: form.neighbourhood, platform: 'kijiji' }),
      });
      if (res.ok) { const d = await res.json(); set('description', d.copy); }
    } finally { setGeneratingCopy(false); }
  };

  const submit = async () => {
    if (!form.title || !form.category) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/calgary-classifieds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, category: form.category,
          subcategory: form.subcategory || null,
          price: form.price ? parseFloat(form.price) : null,
          price_type: form.price_type,
          description: form.description || null,
          neighbourhood: form.neighbourhood || null,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          images: form.images ? form.images.split('\n').map(s => s.trim()).filter(Boolean) : null,
          tags: form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : null,
        }),
      });
      if (res.ok) { onCreated(); onClose(); }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">New Calgary Listing</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Step {step} of 4</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Step indicators */}
          <div className="flex gap-2 mb-4">
            {['Basic Info','Description','Contact','Platforms'].map((s,i) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${step > i ? 'bg-blue-600' : step === i+1 ? 'bg-blue-400' : 'bg-gray-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 2020 Toyota Camry LE — Low KMs" value={form.title} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. SUV, Condo, Barista" value={form.subcategory} onChange={e => set('subcategory', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. 15000" value={form.price} onChange={e => set('price', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.price_type} onChange={e => set('price_type', e.target.value)}>
                    {['fixed','negotiable','free','obo','contact'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.neighbourhood} onChange={e => set('neighbourhood', e.target.value)}>
                  {NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <button onClick={generateDesc} disabled={generatingCopy || !form.title}
                  className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {generatingCopy ? 'Generating...' : 'AI Generate (Kijiji style)'}
                </button>
              </div>
              <textarea rows={12} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="Describe your listing..." value={form.description} onChange={e => set('description', e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. toyota, sedan, low-km" value={form.tags} onChange={e => set('tags', e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URLs (one per line)</label>
                <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="https://..." value={form.images} onChange={e => set('images', e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select platforms to syndicate this listing to. All will start as <strong>pending</strong> — use Platform Tracker to mark as posted.</p>
              <div className="grid grid-cols-1 gap-2">
                {PLATFORMS.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={selectedPlatforms.includes(p.id)}
                      onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev,p.id] : prev.filter(x=>x!==p.id))} />
                    <span className="text-lg">{p.emoji}</span>
                    <span className="text-sm font-medium flex-1">{p.name}</span>
                    <span className="text-xs text-gray-400">avg {p.avg_days}d · {p.category}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-between">
          <button onClick={() => step > 1 ? setStep(s => s-1) : onClose()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4
            ? <button onClick={() => setStep(s => s+1)} disabled={step === 1 && !form.title}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                Next
              </button>
            : <button onClick={submit} disabled={saving}
                className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Listing'}
              </button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Modal: Mark as Posted ─────────────────────────────────────────────────────
function MarkPostedModal({ listingId, platform, onClose, onSaved }: {
  listingId: number; platform: string; onClose: () => void; onSaved: () => void;
}) {
  const [url, setUrl] = useState('');
  const [adId, setAdId] = useState('');
  const [saving, setSaving] = useState(false);
  const p = platformById(platform);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/calgary-classifieds/${listingId}/platform/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'posted', platform_url: url || null, platform_ad_id: adId || null }),
      });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Mark as Posted — {p?.emoji} {p?.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad URL on Platform</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder={`https://${platform}.com/your-ad-url`} value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform Ad ID (optional)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. 1234567890" value={adId} onChange={e => setAdId(e.target.value)} />
          </div>
          <p className="text-xs text-gray-500">Expiry will be auto-calculated ({p?.avg_days} days from now).</p>
        </div>
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Mark Posted'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Copy Preview ───────────────────────────────────────────────────────
function CopyModal({ copy, platform, onClose }: { copy: string; platform: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const p = platformById(platform);
  const doCopy = () => { navigator.clipboard.writeText(copy); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{p?.emoji} {p?.name} — Optimized Copy</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{copy}</div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Close</button>
          <button onClick={doCopy} className={`px-5 py-2 text-sm rounded-lg text-white ${copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Lead Log ───────────────────────────────────────────────────────────
function LeadLogModal({ listings, onClose, onSaved }: { listings: Listing[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ listing_id: '', platform: '', name: '', email: '', phone: '', message: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.listing_id) return;
    setSaving(true);
    try {
      await fetch('/api/admin/calgary-classifieds/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, listing_id: Number(form.listing_id) }),
      });
      onSaved(); onClose();
    } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Log a Lead</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Listing *</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.listing_id} onChange={e => set('listing_id', e.target.value)}>
              <option value="">Select listing...</option>
              {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="">Unknown</option>
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.message} onChange={e => set('message', e.target.value)} />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || !form.listing_id} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Log Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Command Center ─────────────────────────────────────────────────────
function CommandCenterTab({ stats, listings, leads }: { stats: Stats | null; listings: Listing[]; leads: Lead[] }) {
  if (!stats) return <div className="text-center py-20 text-gray-400">Loading stats...</div>;

  const platformsPosted = stats.platform_coverage.filter(p => p.posted > 0).length;
  const topListings = [...listings]
    .sort((a, b) => {
      const aScore = a.platform_statuses.reduce((s, p) => s + p.views_count + p.responses_count, 0);
      const bScore = b.platform_statuses.reduce((s, p) => s + p.views_count + p.responses_count, 0);
      return bScore - aScore;
    })
    .slice(0, 3);
  const recentLeads = [...leads].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0,5);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Listings', value: stats.total_listings, color: 'text-blue-700' },
          { label: 'Active', value: stats.by_status.active ?? 0, color: 'text-green-700' },
          { label: 'Total Leads', value: stats.total_leads, color: 'text-purple-700' },
          { label: 'Platforms Covered', value: `${platformsPosted}/10`, color: 'text-orange-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Platform Coverage Matrix */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Platform Coverage Matrix</h3>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(p => {
            const cov = stats.platform_coverage.find(c => c.platform === p.id);
            const posted = cov?.posted ?? 0;
            const pending = cov?.pending ?? 0;
            const failed = cov?.failed ?? 0;
            const dotColor = posted > 0 ? 'bg-green-500' : failed > 0 ? 'bg-red-500' : pending > 0 ? 'bg-yellow-400' : 'bg-gray-300';
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-sm">{p.emoji} {p.name}</span>
                <div className="ml-auto flex gap-2 text-xs text-gray-500">
                  {posted > 0 && <span className="text-green-700">{posted} posted</span>}
                  {pending > 0 && <span className="text-yellow-700">{pending} pending</span>}
                  {failed > 0 && <span className="text-red-700">{failed} failed</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Performing Listings */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Performing Listings</h3>
          {topListings.length === 0 && <p className="text-sm text-gray-400">No listings yet.</p>}
          <div className="space-y-3">
            {topListings.map((l, i) => {
              const views = l.platform_statuses.reduce((s, p) => s + p.views_count, 0);
              const responses = l.platform_statuses.reduce((s, p) => s + p.responses_count, 0);
              return (
                <div key={l.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 flex-shrink-0">
                    {i+1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{l.title}</div>
                    <div className="text-xs text-gray-500">{views} views · {responses} responses</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Leads</h3>
          {recentLeads.length === 0 && <p className="text-sm text-gray-400">No leads yet.</p>}
          <div className="space-y-3">
            {recentLeads.map(l => (
              <div key={l.id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                  {(l.name ?? '?')[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{l.name ?? 'Anonymous'}</div>
                  <div className="text-xs text-gray-500 truncate">{l.listing_title}</div>
                  {l.platform && <div className="text-xs text-blue-600">{platformById(l.platform)?.emoji} {platformById(l.platform)?.name}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${l.status === 'new' ? 'bg-blue-100 text-blue-700' : l.status === 'converted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 2: Listings ───────────────────────────────────────────────────────────
function ListingsTab({ listings, onRefresh }: { listings: Listing[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [nbrFilter, setNbrFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = listings.filter(l =>
    (!catFilter || l.category === catFilter) &&
    (!statusFilter || l.status === statusFilter) &&
    (!nbrFilter || l.neighbourhood === nbrFilter) &&
    (!search || l.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} onCreated={onRefresh} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={nbrFilter} onChange={e => setNbrFilter(e.target.value)}>
          <option value="">All Neighbourhoods</option>
          {NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
          placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setShowCreate(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + Create Listing
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <div>No listings found. Create your first Calgary listing!</div>
        </div>
      )}

      {/* Listing Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map(l => {
          const views = l.platform_statuses.reduce((s, p) => s + p.views_count, 0);
          const responses = l.platform_statuses.reduce((s, p) => s + p.responses_count, 0);
          return (
            <div key={l.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryBadge(l.category)}`}>{l.category.replace('_',' ')}</span>
                    {l.neighbourhood && <span className="text-xs text-gray-500">{l.neighbourhood}, Calgary</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'active' ? 'bg-green-100 text-green-700' : l.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>{l.status}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{l.title}</h3>
                  <div className="text-sm text-gray-500 mt-0.5">{fmtPrice(l.price, l.price_type)}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
                  <span title="Total views">👁 {views}</span>
                  <span title="Total responses">💬 {responses}</span>
                </div>
              </div>

              {/* Platform status strip */}
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {PLATFORMS.map(p => {
                  const ps = l.platform_statuses.find(s => s.platform === p.id);
                  const statusColor = ps ? platformDot(ps.status) : 'bg-gray-200';
                  return (
                    <div key={p.id} title={`${p.name}: ${ps?.status ?? 'not set'}`}
                      className={`w-3.5 h-3.5 rounded-full ${statusColor}`} />
                  );
                })}
                <span className="text-xs text-gray-400 ml-1 self-center">
                  {l.platform_statuses.filter(p => p.status === 'posted').length}/10 posted
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 3: Platform Tracker ───────────────────────────────────────────────────
function PlatformTrackerTab({ listings, onRefresh }: { listings: Listing[]; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [markPosted, setMarkPosted] = useState<{ listingId: number; platform: string } | null>(null);
  const [copyModal, setCopyModal] = useState<{ copy: string; platform: string } | null>(null);
  const [generatingCopy, setGeneratingCopy] = useState<string | null>(null);
  const [editStats, setEditStats] = useState<Record<string, { views: string; responses: string }>>({});
  const [savingStats, setSavingStats] = useState<string | null>(null);

  const selectedListing = listings.find(l => l.id === selectedId);

  const generateCopy = async (listing: Listing, platformId: string) => {
    setGeneratingCopy(platformId);
    try {
      const res = await fetch('/api/admin/calgary-classifieds/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: listing.title,
          category: listing.category,
          key_features: listing.description?.slice(0, 300),
          price: listing.price,
          neighbourhood: listing.neighbourhood,
          platform: platformId,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setCopyModal({ copy: d.copy, platform: platformId });
      }
    } finally { setGeneratingCopy(null); }
  };

  const saveStats = async (listing: Listing, platformId: string) => {
    const e = editStats[platformId];
    if (!e) return;
    setSavingStats(platformId);
    try {
      await fetch(`/api/admin/calgary-classifieds/${listing.id}/platform/${platformId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          views_count: parseInt(e.views) || 0,
          responses_count: parseInt(e.responses) || 0,
        }),
      });
      onRefresh();
      setEditStats(prev => { const n = { ...prev }; delete n[platformId]; return n; });
    } finally { setSavingStats(null); }
  };

  return (
    <div className="space-y-5">
      {markPosted && <MarkPostedModal listingId={markPosted.listingId} platform={markPosted.platform}
        onClose={() => setMarkPosted(null)} onSaved={onRefresh} />}
      {copyModal && <CopyModal copy={copyModal.copy} platform={copyModal.platform} onClose={() => setCopyModal(null)} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Listing to Track</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm max-w-lg"
          value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Choose a listing...</option>
          {listings.map(l => <option key={l.id} value={l.id}>{l.title} — {l.neighbourhood ?? 'Calgary'}</option>)}
        </select>
      </div>

      {!selectedListing && (
        <div className="text-center py-16 text-gray-400">Select a listing to view its platform tracking status.</div>
      )}

      {selectedListing && (
        <div className="space-y-4">
          <div className="bg-slate-800 text-white rounded-xl p-4">
            <div className="font-semibold">{selectedListing.title}</div>
            <div className="text-slate-300 text-sm mt-1">{fmtPrice(selectedListing.price, selectedListing.price_type)} · {selectedListing.neighbourhood}, Calgary · {selectedListing.category}</div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {PLATFORMS.map(p => {
              const ps = selectedListing.platform_statuses.find(s => s.platform === p.id);
              const status = ps?.status ?? 'pending';
              const editing = editStats[p.id];

              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{p.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'posted' ? 'bg-green-100 text-green-700' :
                          status === 'failed' ? 'bg-red-100 text-red-700' :
                          status === 'expired' ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{status}</span>
                        <span className="text-xs text-gray-400">avg {p.avg_days} days</span>
                      </div>

                      {ps?.platform_url && (
                        <div className="text-xs text-blue-600 truncate mb-1">{ps.platform_url}</div>
                      )}

                      {status === 'posted' && (
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                          {editing ? (
                            <>
                              <label className="flex items-center gap-1">
                                Views: <input type="number" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs"
                                  value={editing.views} onChange={e => setEditStats(prev => ({ ...prev, [p.id]: { ...prev[p.id], views: e.target.value } }))} />
                              </label>
                              <label className="flex items-center gap-1">
                                Responses: <input type="number" className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs"
                                  value={editing.responses} onChange={e => setEditStats(prev => ({ ...prev, [p.id]: { ...prev[p.id], responses: e.target.value } }))} />
                              </label>
                              <button onClick={() => saveStats(selectedListing, p.id)} disabled={savingStats === p.id}
                                className="text-green-600 hover:underline disabled:opacity-50">
                                {savingStats === p.id ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditStats(prev => { const n={...prev}; delete n[p.id]; return n; })}
                                className="text-gray-400 hover:underline">Cancel</button>
                            </>
                          ) : (
                            <>
                              <span>👁 {ps?.views_count ?? 0} views</span>
                              <span>💬 {ps?.responses_count ?? 0} responses</span>
                              {ps?.expires_at && <span>Expires: {new Date(ps.expires_at).toLocaleDateString('en-CA')}</span>}
                              <button onClick={() => setEditStats(prev => ({ ...prev, [p.id]: { views: String(ps?.views_count ?? 0), responses: String(ps?.responses_count ?? 0) } }))}
                                className="text-blue-500 hover:underline">Edit stats</button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-400 mb-2">
                        Post here: <span className="font-mono text-gray-500">{p.post_url}</span>
                        <button onClick={() => window.open(p.post_url, '_blank')} className="ml-2 text-blue-500 hover:underline">[Open]</button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {status !== 'posted' && (
                        <button onClick={() => setMarkPosted({ listingId: selectedListing.id, platform: p.id })}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                          Mark Posted
                        </button>
                      )}
                      <button onClick={() => generateCopy(selectedListing, p.id)}
                        disabled={generatingCopy === p.id}
                        className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                        {generatingCopy === p.id ? 'Generating...' : 'Copy for Platform'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 4: AI Copy Studio ─────────────────────────────────────────────────────
function CopyStudioTab({ listings }: { listings: Listing[] }) {
  const [useManual, setUseManual] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState({ title: '', category: 'for_sale', key_features: '', price: '', neighbourhood: 'NW' });
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['kijiji','craigslist','facebook_marketplace']);
  const [results, setResults] = useState<Record<string, { copy: string; generated_by: string } | null>>({});
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedListing = listings.find(l => l.id === selectedListingId);
  const setM = (k: string, v: string) => setManualForm(f => ({ ...f, [k]: v }));

  const generateAll = async () => {
    setGenerating(true);
    setResults({});
    const src = useManual ? manualForm : selectedListing
      ? { title: selectedListing.title, category: selectedListing.category, key_features: selectedListing.description?.slice(0,300) ?? '', price: selectedListing.price ?? '', neighbourhood: selectedListing.neighbourhood ?? 'Calgary' }
      : null;
    if (!src) { setGenerating(false); return; }

    await Promise.all(selectedPlatforms.map(async p => {
      try {
        const res = await fetch('/api/admin/calgary-classifieds/generate-copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...src, platform: p }),
        });
        if (res.ok) { const d = await res.json(); setResults(prev => ({ ...prev, [p]: { copy: d.copy, generated_by: d.generated_by } })); }
        else { setResults(prev => ({ ...prev, [p]: null })); }
      } catch { setResults(prev => ({ ...prev, [p]: null })); }
    }));
    setGenerating(false);
  };

  const doCopy = (platformId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(platformId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={!useManual} onChange={() => setUseManual(false)} /> From Listing
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={useManual} onChange={() => setUseManual(true)} /> Manual Entry
          </label>
        </div>

        {!useManual && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Listing</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={selectedListingId ?? ''} onChange={e => setSelectedListingId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Choose a listing...</option>
              {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        )}

        {useManual && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={manualForm.title} onChange={e => setM('title', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={manualForm.category} onChange={e => setM('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={manualForm.price} onChange={e => setM('price', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={manualForm.neighbourhood} onChange={e => setM('neighbourhood', e.target.value)}>
                {NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Features</label>
              <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="One feature per line..." value={manualForm.key_features} onChange={e => setM('key_features', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Generate for Platforms</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                <input type="checkbox" checked={selectedPlatforms.includes(p.id)}
                  onChange={e => setSelectedPlatforms(prev => e.target.checked ? [...prev,p.id] : prev.filter(x=>x!==p.id))} />
                <span>{p.emoji} {p.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button onClick={generateAll} disabled={generating || (!selectedListingId && !manualForm.title) || selectedPlatforms.length === 0}
          className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50">
          {generating ? 'Generating All...' : `Generate for ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {/* Platform tips */}
      <div className="bg-blue-50 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Platform Best Practices</h4>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(p => (
            <div key={p.id} className="text-xs text-blue-800">
              <span className="font-medium">{p.emoji} {p.name}:</span> {PLATFORM_TIPS[p.id] ?? '200-300 words, clear and concise.'}
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {selectedPlatforms.some(p => results[p] !== undefined) && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Generated Copy</h3>
          {selectedPlatforms.map(platformId => {
            const result = results[platformId];
            const p = platformById(platformId);
            if (result === undefined) return null;
            return (
              <div key={platformId} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p?.emoji}</span>
                    <span className="font-medium">{p?.name}</span>
                    {result && <span className="text-xs text-gray-400">via {result.generated_by}</span>}
                  </div>
                  {result && (
                    <button onClick={() => doCopy(platformId, result.copy)}
                      className={`text-xs px-3 py-1.5 rounded-lg text-white ${copied === platformId ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                      {copied === platformId ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                {result
                  ? <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{result.copy}</div>
                  : <div className="text-sm text-red-500">Failed to generate copy for this platform.</div>
                }
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Leads ──────────────────────────────────────────────────────────────
function LeadsTab({ listings }: { listings: Listing[] }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingFilter, setListingFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedLead, setExpandedLead] = useState<number | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const loadLeads = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (listingFilter) params.set('listing_id', listingFilter);
    if (platformFilter) params.set('platform', platformFilter);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/calgary-classifieds/leads?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.leads) setLeads(d.leads); })
      .finally(() => setLoading(false));
  }, [listingFilter, platformFilter, statusFilter]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingStatus(id);
    try {
      await fetch('/api/admin/calgary-classifieds/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      loadLeads();
    } finally { setUpdatingStatus(null); }
  };

  // Stats
  const platformCounts: Record<string, number> = {};
  for (const l of leads) { if (l.platform) platformCounts[l.platform] = (platformCounts[l.platform] ?? 0) + 1; }
  const maxCount = Math.max(...Object.values(platformCounts), 1);

  return (
    <div className="space-y-5">
      {showLogModal && <LeadLogModal listings={listings} onClose={() => setShowLogModal(false)} onSaved={loadLeads} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={listingFilter} onChange={e => setListingFilter(e.target.value)}>
          <option value="">All Listings</option>
          {listings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowLogModal(true)} className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + Log Lead
        </button>
      </div>

      {/* Leads by platform bar chart */}
      {Object.keys(platformCounts).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Leads by Platform</h3>
          <div className="space-y-2">
            {Object.entries(platformCounts).sort((a,b) => b[1]-a[1]).map(([pid, count]) => {
              const p = platformById(pid);
              return (
                <div key={pid} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600 truncate text-right">{p?.emoji} {p?.name ?? pid}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="bg-blue-500 h-4 rounded-full transition-all" style={{ width: `${(count/maxCount)*100}%` }} />
                  </div>
                  <div className="text-xs text-gray-600 w-8 text-right">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leads table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading && <div className="text-center py-10 text-gray-400">Loading leads...</div>}
        {!loading && leads.length === 0 && <div className="text-center py-10 text-gray-400">No leads yet.</div>}
        {!loading && leads.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date','Name','Contact','Platform','Listing','Message','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map(lead => {
                const p = lead.platform ? platformById(lead.platform) : null;
                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{lead.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {lead.email && <div>{lead.email}</div>}
                      {lead.phone && <div>{lead.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">{p ? `${p.emoji} ${p.name}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">{lead.listing_title ?? fmt(lead.listing_id)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[180px]">
                      {lead.message
                        ? <button onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                            className="text-left hover:underline text-blue-600">
                            {expandedLead === lead.id ? lead.message : lead.message.slice(0, 50) + (lead.message.length > 50 ? '...' : '')}
                          </button>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        disabled={updatingStatus === lead.id}
                        onChange={e => updateStatus(lead.id, e.target.value)}
                        className={`text-xs border rounded-lg px-2 py-1 ${
                          lead.status === 'new' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                          lead.status === 'converted' ? 'border-green-200 bg-green-50 text-green-700' :
                          lead.status === 'lost' ? 'border-red-200 bg-red-50 text-red-700' :
                          'border-gray-200 bg-gray-50 text-gray-700'
                        }`}>
                        {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CalgaryClassifiedsPage() {
  const [tab, setTab] = useState<Tab>('command');
  const [listings, setListings] = useState<Listing[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingListings, setLoadingListings] = useState(true);

  const loadListings = useCallback(() => {
    setLoadingListings(true);
    fetch('/api/admin/calgary-classifieds')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.listings) setListings(d.listings); })
      .finally(() => setLoadingListings(false));
  }, []);

  const loadLeads = useCallback(() => {
    fetch('/api/admin/calgary-classifieds/leads')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.leads) setLeads(d.leads); });
  }, []);

  const loadStats = useCallback(() => {
    fetch('/api/admin/calgary-classifieds/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); });
  }, []);

  useEffect(() => {
    loadListings();
    loadLeads();
    loadStats();
  }, [loadListings, loadLeads, loadStats]);

  const handleRefresh = useCallback(() => {
    loadListings();
    loadLeads();
    loadStats();
  }, [loadListings, loadLeads, loadStats]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'command', label: 'Command Center' },
    { id: 'listings', label: 'Listings' },
    { id: 'tracker', label: 'Platform Tracker' },
    { id: 'copy-studio', label: 'AI Copy Studio' },
    { id: 'leads', label: 'Leads' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Calgary Multi-Classifieds Hub</h1>
              <p className="text-slate-400 text-sm mt-1">Syndicate listings across 10 Calgary platforms — Kijiji, Craigslist, Facebook Marketplace, and more</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {stats && (
                <>
                  <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
                    <div className="text-lg font-bold text-white">{stats.total_listings}</div>
                    <div className="text-xs text-slate-400">Listings</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
                    <div className="text-lg font-bold text-green-400">{stats.by_status.active ?? 0}</div>
                    <div className="text-xs text-slate-400">Active</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
                    <div className="text-lg font-bold text-purple-400">{stats.total_leads}</div>
                    <div className="text-xs text-slate-400">Leads</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
                  tab === t.id ? 'bg-white text-slate-800 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loadingListings && tab !== 'command' && (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        )}

        {(!loadingListings || tab === 'command') && (
          <>
            {tab === 'command' && <CommandCenterTab stats={stats} listings={listings} leads={leads} />}
            {tab === 'listings' && <ListingsTab listings={listings} onRefresh={handleRefresh} />}
            {tab === 'tracker' && <PlatformTrackerTab listings={listings} onRefresh={handleRefresh} />}
            {tab === 'copy-studio' && <CopyStudioTab listings={listings} />}
            {tab === 'leads' && <LeadsTab listings={listings} />}
          </>
        )}
      </div>
    </div>
  );
}
