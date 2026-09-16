'use client';
import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Platform metadata
// ---------------------------------------------------------------------------
const RE_PLATFORMS = [
  { id: 'realtor_ca',    name: 'Realtor.ca',      emoji: '🏠', type: 'mls',       timeline: '24-48h review' },
  { id: 'zolo',          name: 'Zolo.ca',          emoji: '🔵', type: 'portal',    timeline: 'Immediate' },
  { id: 'housesigma',    name: 'HouseSigma',       emoji: '📊', type: 'portal',    timeline: 'Immediate' },
  { id: 'zoocasa',       name: 'Zoocasa',          emoji: '🦘', type: 'portal',    timeline: '24h' },
  { id: 'point2homes',   name: 'Point2Homes',      emoji: '📍', type: 'portal',    timeline: 'Immediate' },
  { id: 'remax',         name: 'RE/MAX Canada',    emoji: '🔴', type: 'brokerage', timeline: 'Agent-submitted' },
  { id: 'royal_lepage',  name: 'Royal LePage',     emoji: '🟡', type: 'brokerage', timeline: 'Agent-submitted' },
  { id: 'property_guys', name: 'PropertyGuys.com', emoji: '🏡', type: 'fsbo',      timeline: 'Immediate' },
  { id: 'zillow_ca',     name: 'Zillow Canada',    emoji: '🟦', type: 'portal',    timeline: '24h' },
  { id: 'condos_ca',     name: 'Condos.ca',        emoji: '🏢', type: 'condo',     timeline: 'Immediate' },
] as const;

const TABS = ['dashboard', 'listings', 'syndication', 'ai-studio', 'leads', 'open-houses'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  'dashboard':    'Portfolio Dashboard',
  'listings':     'Listings',
  'syndication':  'Platform Syndication',
  'ai-studio':    'AI Listing Studio',
  'leads':        'Leads & Showings',
  'open-houses':  'Open Houses',
};

// ---------------------------------------------------------------------------
// Neighbourhood list
// ---------------------------------------------------------------------------
const CALGARY_NEIGHBOURHOODS = [
  'Beltline','Mission','Kensington','Inglewood','Bridgeland','Hillhurst','Altadore',
  'Marda Loop','Oakridge','Signal Hill','Tuscany','Sage Hill','Evanston','Nolan Hill',
  'Cornerstone','Mahogany','Auburn Bay','McKenzie Towne','Legacy','Walden','Copperfield',
  'New Brighton','Cranston','Chaparral','Seton','Livingston','Carrington','Cityscape',
  'Skyview Ranch','Redstone','Saddle Ridge','Taradale','Martindale','Falconridge',
  'Castleridge','Temple','Pineridge','Whitehorn','Rundle','Penbrooke','Forest Lawn',
  'Dover','Erin Woods','Ogden','Riverbend','Douglasdale','Quarry Park','Lake Bonavista',
  'Midnapore','Sundance','Shawnessy','Millrise','Evergreen','Bridlewood','Somerset',
  'Yorkville','Silverado','Belmont',
];

const COMMON_FEATURES = [
  'Central Air Conditioning','Forced Air Heating','In-Floor Heating','Double Attached Garage',
  'Triple Attached Garage','Finished Basement','Legal Basement Suite','Walkout Basement',
  'Hardwood Floors','Ceramic Tile','Quartz Countertops','Granite Countertops',
  'Stainless Steel Appliances','Island Kitchen','Butler Pantry','Main Floor Laundry',
  'Upper Floor Laundry','Vaulted Ceilings','9 Ft Ceilings','Open Concept',
  'Bonus Room','Home Office','Smart Home','Solar Panels','EV Charging',
  'Deck','Patio','Backyard','Landscaped','Sprinkler System',
  'Fireplace','Central Vacuum','Heated Garage','Oversized Lot',
  'Backing Greenspace','No Rear Neighbours','Corner Lot','Cul-de-sac',
  'Mountain Views','City Views','Pond Views','Lake Access','Walking Distance to LRT',
  'Walking Distance to School','New Build','Move-in Ready',
];

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------
type PlatformStatus = {
  platform: string; status: string; platform_url: string | null;
  views_count: number; saves_count: number; inquiries_count: number;
};

type Listing = {
  id: number; mls_number: string | null; listing_type: string; property_type: string;
  title: string; address: string; city: string; province: string; postal_code: string | null;
  neighbourhood: string | null; price: number | null; bedrooms: number | null;
  bathrooms: number | null; sq_ft: number | null; lot_size: string | null;
  year_built: number | null; garage: string | null; basement: string | null;
  description: string | null; features: string[] | null; images: string[] | null;
  virtual_tour_url: string | null; open_house_dates: OpenHouseDate[];
  listing_agent: string | null; brokerage: string | null; commission_pct: number | null;
  status: string; days_on_market: number | null; listed_at: string | null;
  sold_at: string | null; sold_price: number | null; created_at: string;
  platform_statuses: PlatformStatus[]; lead_count: number;
};

type Stats = {
  total: number; active: number; pending: number; sold: number; draft: number;
  total_value: number; avg_price: number; avg_dom: number;
};

type Lead = {
  id: number; listing_id: number | null; platform: string | null;
  name: string; email: string | null; phone: string | null; message: string | null;
  lead_type: string; status: string; budget: number | null; pre_approved: boolean;
  notes: string | null; created_at: string;
  listing_title?: string; listing_address?: string; listing_price?: number;
};

type LeadStats = {
  total: number; inquiries: number; showings: number; offers: number;
  pre_approvals: number; new_leads: number; converted: number; pre_approved_count: number;
};

type OpenHouseDate = { date: string; start_time: string; end_time: string; notes?: string };

// ---------------------------------------------------------------------------
// Utility components
// ---------------------------------------------------------------------------
function KpiCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const borders: Record<string, string> = {
    blue:   'border-l-4 border-blue-500 bg-blue-50',
    green:  'border-l-4 border-green-500 bg-green-50',
    amber:  'border-l-4 border-amber-500 bg-amber-50',
    purple: 'border-l-4 border-purple-500 bg-purple-50',
    red:    'border-l-4 border-red-500 bg-red-50',
    indigo: 'border-l-4 border-indigo-500 bg-indigo-50',
  };
  return (
    <div className={`rounded-lg p-4 ${borders[color] || borders.blue}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-green-500' : status === 'pending' || status === 'submitted' ? 'bg-yellow-400' : status === 'rejected' || status === 'expired' ? 'bg-red-500' : 'bg-gray-300';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} title={status} />;
}

const LISTING_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700', sold: 'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-600', withdrawn: 'bg-slate-100 text-slate-600',
};

const LEAD_TYPE_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-100 text-blue-700', showing_request: 'bg-purple-100 text-purple-700',
  offer: 'bg-green-100 text-green-700', pre_approval: 'bg-amber-100 text-amber-700',
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', contacted: 'bg-indigo-100 text-indigo-700',
  showing_scheduled: 'bg-purple-100 text-purple-700', offer_received: 'bg-amber-100 text-amber-700',
  converted: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-600',
};

const PLATFORM_TYPE_COLORS: Record<string, string> = {
  mls: 'bg-red-100 text-red-700', portal: 'bg-blue-100 text-blue-700',
  brokerage: 'bg-amber-100 text-amber-700', fsbo: 'bg-green-100 text-green-700',
  condo: 'bg-purple-100 text-purple-700',
};

function fmt(n: number | null | undefined, currency = false): string {
  if (n == null) return '—';
  if (currency) return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
  return n.toLocaleString('en-CA');
}

async function api<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...options });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Create Listing Modal
// ---------------------------------------------------------------------------
const INITIAL_FORM = {
  step: 1,
  listing_type: 'sale', property_type: 'detached', mls_number: '',
  address: '', neighbourhood: '', price: '', bedrooms: '', bathrooms: '',
  sq_ft: '', lot_size: '', year_built: '', garage: 'double', basement: 'unfinished',
  description: '', features: [] as string[], images: '', virtual_tour_url: '',
  listing_agent: '', brokerage: '', commission_pct: '',
  listed_at: new Date().toISOString().split('T')[0],
  target_platforms: RE_PLATFORMS.map(p => p.id) as string[],
  generating: false,
};

function CreateListingModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }));

  const toggleFeature = (f: string) =>
    set('features', form.features.includes(f) ? form.features.filter(x => x !== f) : [...form.features, f]);

  const togglePlatform = (id: string) =>
    set('target_platforms', form.target_platforms.includes(id)
      ? form.target_platforms.filter(p => p !== id)
      : [...form.target_platforms, id]);

  const generateDescription = async () => {
    set('generating', true);
    const res = await api<{ description: string }>('/api/admin/real-estate-portal/generate-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_type: form.property_type, address: form.address,
        neighbourhood: form.neighbourhood, bedrooms: form.bedrooms,
        bathrooms: form.bathrooms, sq_ft: form.sq_ft,
        year_built: form.year_built, features: form.features,
        price: form.price, listing_type: form.listing_type,
      }),
    });
    set('generating', false);
    if (res?.description) set('description', res.description);
  };

  const handleSubmit = async () => {
    setSaving(true); setError('');
    const title = `${form.bedrooms ? form.bedrooms + 'bd ' : ''}${form.bathrooms ? form.bathrooms + 'ba ' : ''}${form.property_type.replace(/_/g, ' ')} in ${form.neighbourhood || form.address.split(',')[0] || 'Calgary'}`;
    const res = await api<{ listing?: { id: number } }>('/api/admin/real-estate-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        title,
        price: form.price ? parseFloat(form.price) : null,
        bedrooms: form.bedrooms ? parseFloat(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
        sq_ft: form.sq_ft ? parseInt(form.sq_ft, 10) : null,
        year_built: form.year_built ? parseInt(form.year_built, 10) : null,
        commission_pct: form.commission_pct ? parseFloat(form.commission_pct) : null,
        images: form.images ? form.images.split('\n').map(u => u.trim()).filter(Boolean) : [],
        listed_at: form.listed_at || null,
      }),
    });
    setSaving(false);
    if (res?.listing) { onCreated(); onClose(); }
    else setError('Failed to create listing. Check all required fields.');
  };

  const stepLabels = ['Type & MLS', 'Property Details', 'Description', 'Features & Media', 'Agent & Platforms'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-800 rounded-t-xl">
          <h2 className="text-white font-bold text-lg">New Listing</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white text-xl font-bold">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1 text-center">
              <div className={`text-xs font-medium mb-1 ${form.step === i + 1 ? 'text-indigo-700' : form.step > i + 1 ? 'text-green-600' : 'text-gray-400'}`}>
                {i + 1}. {label}
              </div>
              <div className={`h-1 rounded-full ${form.step === i + 1 ? 'bg-indigo-500' : form.step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Step 1 */}
          {form.step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type *</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.listing_type} onChange={e => set('listing_type', e.target.value)}>
                    <option value="sale">For Sale</option>
                    <option value="lease">For Lease</option>
                    <option value="sold">Sold</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.property_type} onChange={e => set('property_type', e.target.value)}>
                    {['detached','semi_detached','townhouse','condo','apartment','land','commercial','multi_family'].map(t =>
                      <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MLS Number</label>
                <input className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. A2345678" value={form.mls_number} onChange={e => set('mls_number', e.target.value)} />
              </div>
            </>
          )}

          {/* Step 2 */}
          {form.step === 2 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input className="w-full border rounded px-3 py-2 text-sm" placeholder="123 Main St SW, Calgary, AB" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neighbourhood</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.neighbourhood} onChange={e => set('neighbourhood', e.target.value)}>
                    <option value="">Select...</option>
                    {CALGARY_NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (CAD)</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="650000" value={form.price} onChange={e => set('price', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[['bedrooms','Beds'],['bathrooms','Baths'],['sq_ft','Sq Ft'],['year_built','Year Built']].map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input className="w-full border rounded px-3 py-2 text-sm" type="number" value={(form as Record<string, unknown>)[key] as string} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lot Size</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 50x120 ft" value={form.lot_size} onChange={e => set('lot_size', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Garage</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.garage} onChange={e => set('garage', e.target.value)}>
                    {['none','single','double','triple','tandem'].map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basement</label>
                  <select className="w-full border rounded px-3 py-2 text-sm" value={form.basement} onChange={e => set('basement', e.target.value)}>
                    {['none','unfinished','finished','walkout','legal_suite'].map(b => <option key={b} value={b}>{b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Step 3 */}
          {form.step === 3 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Property Description</label>
                <button
                  onClick={generateDescription}
                  disabled={form.generating}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {form.generating ? 'Generating...' : 'AI Generate'}
                </button>
              </div>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm h-48 resize-none"
                placeholder="Professional MLS-style listing description..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
              <p className="text-xs text-gray-400">Click AI Generate to auto-fill based on property details. {form.description.length} characters.</p>
            </>
          )}

          {/* Step 4 */}
          {form.step === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border rounded p-3">
                  {COMMON_FEATURES.map(f => (
                    <label key={f} className="flex items-center gap-2 text-sm cursor-pointer hover:text-indigo-700">
                      <input type="checkbox" checked={form.features.includes(f)} onChange={() => toggleFeature(f)} className="rounded" />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{form.features.length} features selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URLs (one per line)</label>
                <textarea className="w-full border rounded px-3 py-2 text-sm h-24 resize-none" placeholder="https://example.com/photo1.jpg" value={form.images} onChange={e => set('images', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Virtual Tour URL</label>
                <input className="w-full border rounded px-3 py-2 text-sm" placeholder="https://my.matterport.com/..." value={form.virtual_tour_url} onChange={e => set('virtual_tour_url', e.target.value)} />
              </div>
            </>
          )}

          {/* Step 5 */}
          {form.step === 5 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Agent</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Agent Name" value={form.listing_agent} onChange={e => set('listing_agent', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brokerage</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. RE/MAX Real Estate" value={form.brokerage} onChange={e => set('brokerage', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" type="number" step="0.01" placeholder="3.50" value={form.commission_pct} onChange={e => set('commission_pct', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Listing Date</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" type="date" value={form.listed_at} onChange={e => set('listed_at', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Platforms</label>
                <div className="grid grid-cols-2 gap-1">
                  {RE_PLATFORMS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-indigo-700 border rounded px-2 py-1">
                      <input type="checkbox" checked={form.target_platforms.includes(p.id)} onChange={() => togglePlatform(p.id)} className="rounded" />
                      <span>{p.emoji} {p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
            </>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={() => form.step > 1 ? set('step', form.step - 1) : onClose()} className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-100">
            {form.step > 1 ? 'Back' : 'Cancel'}
          </button>
          {form.step < 5
            ? <button onClick={() => set('step', form.step + 1)} className="px-5 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Next</button>
            : <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">{saving ? 'Creating...' : 'Create Listing'}</button>
          }
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Open House Modal
// ---------------------------------------------------------------------------
function AddOpenHouseModal({ listings, onClose, onSaved }: { listings: Listing[]; onClose: () => void; onSaved: () => void }) {
  const [listingId, setListingId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('15:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!listingId || !date) return;
    setSaving(true);
    const listing = listings.find(l => l.id === parseInt(listingId, 10));
    if (!listing) { setSaving(false); return; }
    const existing: OpenHouseDate[] = Array.isArray(listing.open_house_dates) ? listing.open_house_dates : [];
    const updated = [...existing, { date, start_time: startTime, end_time: endTime, notes }];
    await api(`/api/admin/real-estate-portal/${listingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open_house_dates: updated }),
    });
    setSaving(false);
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-bold text-lg mb-4">Add Open House</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Listing *</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={listingId} onChange={e => setListingId(e.target.value)}>
              <option value="">Select listing...</option>
              {listings.filter(l => l.status === 'active').map(l => (
                <option key={l.id} value={l.id}>{l.address} — {fmt(l.price, true)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="time" className="w-full border rounded px-3 py-2 text-sm" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input type="time" className="w-full border rounded px-3 py-2 text-sm" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Refreshments provided, agent on-site..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving || !listingId || !date} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Open House'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log Lead Modal
// ---------------------------------------------------------------------------
function LogLeadModal({ listings, onClose, onSaved }: { listings: Listing[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    listing_id: '', platform: '', name: '', email: '', phone: '',
    message: '', lead_type: 'inquiry', status: 'new',
    budget: '', pre_approved: false, notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    await api('/api/admin/real-estate-portal/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        listing_id: form.listing_id ? parseInt(form.listing_id, 10) : null,
        budget: form.budget ? parseFloat(form.budget) : null,
      }),
    });
    setSaving(false);
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 className="font-bold text-lg mb-4">Log Lead</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="w-full border rounded px-3 py-2 text-sm" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="w-full border rounded px-3 py-2 text-sm" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Type</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.lead_type} onChange={e => set('lead_type', e.target.value)}>
                <option value="inquiry">Inquiry</option>
                <option value="showing_request">Showing Request</option>
                <option value="offer">Offer</option>
                <option value="pre_approval">Pre-Approval</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="">Direct</option>
                {RE_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Listing</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.listing_id} onChange={e => set('listing_id', e.target.value)}>
                <option value="">Not specific</option>
                {listings.map(l => <option key={l.id} value={l.id}>{l.address}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (CAD)</label>
              <input className="w-full border rounded px-3 py-2 text-sm" type="number" value={form.budget} onChange={e => set('budget', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea className="w-full border rounded px-3 py-2 text-sm h-20 resize-none" value={form.message} onChange={e => set('message', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.pre_approved} onChange={e => set('pre_approved', e.target.checked)} />
            Pre-approved buyer
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Log Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RealEstatePortalPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [insights, setInsights] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [showAddOpenHouse, setShowAddOpenHouse] = useState(false);
  const [showLogLead, setShowLogLead] = useState(false);

  // Filters — Listings tab
  const [filterType, setFilterType] = useState('');
  const [filterPropType, setFilterPropType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNeighbourhood, setFilterNeighbourhood] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterMinBeds, setFilterMinBeds] = useState('');

  // Syndication tab
  const [syndicationListingId, setSyndicationListingId] = useState<string>('');
  const [syndicationDetails, setSyndicationDetails] = useState<{ listing: Listing; platforms: PlatformStatus[] } | null>(null);
  const [platformUpdating, setPlatformUpdating] = useState<string>('');

  // AI Studio
  const [aiForm, setAiForm] = useState({
    property_type: 'detached', address: '', neighbourhood: '', bedrooms: '',
    bathrooms: '', sq_ft: '', year_built: '', features: [] as string[],
    price: '', listing_type: 'sale',
  });
  const [aiDescription, setAiDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInsightNeighbourhood, setAiInsightNeighbourhood] = useState('Beltline');
  const [aiInsightPropType, setAiInsightPropType] = useState('detached');
  const [aiInsightResult, setAiInsightResult] = useState('');
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  // Leads filter
  const [leadFilterListing, setLeadFilterListing] = useState('');
  const [leadFilterPlatform, setLeadFilterPlatform] = useState('');
  const [leadFilterType, setLeadFilterType] = useState('');
  const [leadFilterStatus, setLeadFilterStatus] = useState('');

  const loadListings = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set('listing_type', filterType);
    if (filterPropType) params.set('property_type', filterPropType);
    if (filterStatus) params.set('status', filterStatus);
    if (filterNeighbourhood) params.set('neighbourhood', filterNeighbourhood);
    if (filterMinPrice) params.set('min_price', filterMinPrice);
    if (filterMaxPrice) params.set('max_price', filterMaxPrice);
    if (filterMinBeds) params.set('min_beds', filterMinBeds);
    const res = await api<{ listings: Listing[]; stats: Stats }>(`/api/admin/real-estate-portal?${params}`);
    if (res) { setListings(res.listings); setStats(res.stats); }
  }, [filterType, filterPropType, filterStatus, filterNeighbourhood, filterMinPrice, filterMaxPrice, filterMinBeds]);

  const loadLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (leadFilterListing) params.set('listing_id', leadFilterListing);
    if (leadFilterPlatform) params.set('platform', leadFilterPlatform);
    if (leadFilterType) params.set('lead_type', leadFilterType);
    if (leadFilterStatus) params.set('status', leadFilterStatus);
    const res = await api<{ leads: Lead[]; stats: LeadStats }>(`/api/admin/real-estate-portal/leads?${params}`);
    if (res) { setLeads(res.leads); setLeadStats(res.stats); }
  }, [leadFilterListing, leadFilterPlatform, leadFilterType, leadFilterStatus]);

  useEffect(() => { loadListings(); }, [loadListings]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  const loadMarketInsights = async () => {
    setInsightsLoading(true);
    const res = await api<{ insights: string }>('/api/admin/real-estate-portal/market-insights');
    setInsightsLoading(false);
    if (res) setInsights(res.insights);
  };

  useEffect(() => {
    if (tab === 'dashboard') loadMarketInsights();
  }, [tab]);

  const loadSyndicationListing = async (id: string) => {
    if (!id) { setSyndicationDetails(null); return; }
    const res = await api<{ listing: Listing; platforms: PlatformStatus[] }>(`/api/admin/real-estate-portal/${id}`);
    if (res) setSyndicationDetails(res);
  };

  useEffect(() => { loadSyndicationListing(syndicationListingId); }, [syndicationListingId]);

  const updatePlatform = async (platform: string, data: Record<string, unknown>) => {
    if (!syndicationListingId) return;
    setPlatformUpdating(platform);
    await api(`/api/admin/real-estate-portal/${syndicationListingId}/platform/${platform}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setPlatformUpdating('');
    loadSyndicationListing(syndicationListingId);
  };

  const generateAiDescription = async () => {
    setAiGenerating(true);
    const res = await api<{ description: string }>('/api/admin/real-estate-portal/generate-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiForm),
    });
    setAiGenerating(false);
    if (res?.description) setAiDescription(res.description);
  };

  const generateAiInsights = async () => {
    setAiInsightLoading(true);
    const res = await api<{ recommendation: string }>('/api/admin/real-estate-portal/market-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neighbourhood: aiInsightNeighbourhood, property_type: aiInsightPropType }),
    });
    setAiInsightLoading(false);
    if (res?.recommendation) setAiInsightResult(res.recommendation);
  };

  const updateLeadStatus = async (leadId: number, newStatus: string) => {
    await api(`/api/admin/real-estate-portal/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status: newStatus }), // server just uses POST; status update via lead route (not built as PATCH but acceptable via log-lead workflow)
    });
    loadLeads();
  };

  const withdrawListing = async (id: number) => {
    if (!confirm('Mark this listing as withdrawn?')) return;
    await api(`/api/admin/real-estate-portal/${id}`, { method: 'DELETE' });
    loadListings();
  };

  // Gather all open houses across all listings
  const allOpenHouses = listings.flatMap(l =>
    (Array.isArray(l.open_house_dates) ? l.open_house_dates : []).map(oh => ({
      ...oh, listing_id: l.id, address: l.address, price: l.price,
    }))
  ).sort((a, b) => a.date.localeCompare(b.date));

  const upcomingOpenHouses = allOpenHouses.filter(oh => oh.date >= new Date().toISOString().split('T')[0]);

  // Platform coverage by listing (for dashboard)
  const platformCoverage = listings.slice(0, 5).map(l => ({
    address: l.address, id: l.id,
    platforms: RE_PLATFORMS.map(p => ({
      id: p.id, name: p.name, emoji: p.emoji,
      status: l.platform_statuses?.find(ps => ps.platform === p.id)?.status || 'pending',
    })),
  }));

  const aiToggleFeature = (f: string) =>
    setAiForm(prev => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter(x => x !== f) : [...prev.features, f],
    }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold">Real Estate Portal Hub</h1>
        <p className="text-gray-300 text-sm mt-0.5">Calgary MLS Listing Syndication — 10 Portals</p>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b px-4">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">

        {/* ====== TAB 1: DASHBOARD ====== */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Active Listings" value={stats?.active ?? 0} sub="Currently on market" color="green" />
              <KpiCard label="Portfolio Value" value={fmt(stats?.total_value ?? 0, true)} sub="Active listings total" color="blue" />
              <KpiCard label="Avg Days on Market" value={stats?.avg_dom ? `${Number(stats.avg_dom).toFixed(0)} days` : '—'} sub="Active listings" color="amber" />
              <KpiCard label="Total Leads" value={leadStats?.total ?? 0} sub={`${leadStats?.new_leads ?? 0} new`} color="purple" />
            </div>

            {/* Status funnel */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Status Funnel</h3>
              <div className="flex items-end gap-4">
                {[
                  { label: 'Draft', count: stats?.draft ?? 0, color: 'bg-gray-400' },
                  { label: 'Active', count: stats?.active ?? 0, color: 'bg-green-500' },
                  { label: 'Pending', count: stats?.pending ?? 0, color: 'bg-yellow-400' },
                  { label: 'Sold', count: stats?.sold ?? 0, color: 'bg-blue-500' },
                ].map(({ label, count, color }) => {
                  const total = (stats?.total ?? 1) || 1;
                  const pct = Math.max(8, Math.round((count / total) * 100));
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-lg font-bold text-gray-800">{count}</span>
                      <div className={`w-full rounded-t ${color}`} style={{ height: `${pct * 1.5}px` }} />
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs text-gray-400">{total > 0 ? ((count / total) * 100).toFixed(0) : 0}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Platform Coverage */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Platform Coverage (Top 5 Listings)</h3>
              {platformCoverage.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No listings yet. Create your first listing.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 text-gray-500 font-medium">Listing</th>
                        {RE_PLATFORMS.map(p => (
                          <th key={p.id} className="text-center py-2 px-1 text-gray-500 font-medium text-xs" title={p.name}>{p.emoji}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {platformCoverage.map(l => (
                        <tr key={l.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 pr-4 text-gray-700 max-w-xs truncate">{l.address}</td>
                          {l.platforms.map(p => (
                            <td key={p.id} className="text-center py-2 px-1">
                              <StatusDot status={p.status} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Market Insights */}
            <div className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">AI Market Insights</h3>
                <button onClick={loadMarketInsights} disabled={insightsLoading} className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
                  {insightsLoading ? 'Generating...' : 'Refresh'}
                </button>
              </div>
              {insights
                ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{insights}</p>
                : <p className="text-sm text-gray-400">{insightsLoading ? 'Analyzing portfolio...' : 'Click Refresh to generate insights.'}</p>
              }
            </div>

            {/* Recent Leads */}
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Recent Leads</h3>
              {leads.length === 0
                ? <p className="text-sm text-gray-400">No leads yet.</p>
                : (
                  <div className="space-y-2">
                    {leads.slice(0, 5).map(l => (
                      <div key={l.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <div>
                          <span className="font-medium text-gray-800">{l.name}</span>
                          <span className="text-gray-400 ml-2 text-xs">{l.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge label={l.lead_type.replace(/_/g, ' ')} color={LEAD_TYPE_COLORS[l.lead_type] || 'bg-gray-100 text-gray-600'} />
                          <Badge label={l.status.replace(/_/g, ' ')} color={LEAD_STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* ====== TAB 2: LISTINGS ====== */}
        {tab === 'listings' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <select className="border rounded px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="sale">For Sale</option>
                  <option value="lease">For Lease</option>
                  <option value="sold">Sold</option>
                  <option value="assignment">Assignment</option>
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={filterPropType} onChange={e => setFilterPropType(e.target.value)}>
                  <option value="">All Property Types</option>
                  {['detached','semi_detached','townhouse','condo','apartment','land','commercial','multi_family'].map(t =>
                    <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  )}
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {['draft','active','pending','sold','expired','withdrawn'].map(s =>
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  )}
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={filterNeighbourhood} onChange={e => setFilterNeighbourhood(e.target.value)}>
                  <option value="">All Neighbourhoods</option>
                  {CALGARY_NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <input className="border rounded px-3 py-2 text-sm w-28" type="number" placeholder="Min Price" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} />
                <input className="border rounded px-3 py-2 text-sm w-28" type="number" placeholder="Max Price" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} />
                <input className="border rounded px-3 py-2 text-sm w-24" type="number" placeholder="Min Beds" value={filterMinBeds} onChange={e => setFilterMinBeds(e.target.value)} />
                <button onClick={loadListings} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Filter</button>
                <button onClick={() => setShowCreateListing(true)} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium">+ New Listing</button>
              </div>
            </div>

            {/* Listing cards */}
            {listings.length === 0
              ? <div className="bg-white rounded-xl border border-dashed p-12 text-center text-gray-400">No listings found. Create your first Calgary listing.</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {listings.map(l => (
                    <div key={l.id} className="bg-white rounded-xl border hover:shadow-md transition-shadow">
                      {/* Photo placeholder */}
                      <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-xl flex items-center justify-center">
                        {l.images && l.images.length > 0
                          ? <img src={l.images[0]} alt={l.address} className="h-full w-full object-cover rounded-t-xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          : <span className="text-4xl text-gray-300">{l.property_type === 'condo' || l.property_type === 'apartment' ? '🏢' : '🏠'}</span>
                        }
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-bold text-gray-900 text-lg">{fmt(l.price, true)}</p>
                          <Badge label={l.status} color={LISTING_STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'} />
                        </div>
                        <p className="text-sm text-gray-600 mb-2 truncate">{l.address}</p>
                        {l.neighbourhood && <p className="text-xs text-gray-400 mb-2">{l.neighbourhood}, Calgary AB</p>}
                        <div className="flex gap-2 flex-wrap mb-3">
                          {l.bedrooms != null && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{l.bedrooms} bd</span>}
                          {l.bathrooms != null && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{l.bathrooms} ba</span>}
                          {l.sq_ft && <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{fmt(l.sq_ft)} sqft</span>}
                          {l.mls_number && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">MLS {l.mls_number}</span>}
                        </div>
                        {/* Platform coverage dots */}
                        <div className="flex gap-1 flex-wrap mb-3">
                          {RE_PLATFORMS.map(p => {
                            const ps = l.platform_statuses?.find(x => x.platform === p.id);
                            return <StatusDot key={p.id} status={ps?.status || 'pending'} />;
                          })}
                          <span className="text-xs text-gray-400 ml-1">{l.platform_statuses?.filter(p => p.status === 'active').length ?? 0}/10 live</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{l.days_on_market != null ? `${l.days_on_market} DOM` : 'Not listed'}</span>
                          <span>{l.lead_count} leads</span>
                          <button onClick={() => withdrawListing(l.id)} className="text-red-400 hover:text-red-600">Withdraw</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ====== TAB 3: PLATFORM SYNDICATION ====== */}
        {tab === 'syndication' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Listing</label>
              <select
                className="border rounded px-3 py-2 text-sm w-full max-w-lg"
                value={syndicationListingId}
                onChange={e => setSyndicationListingId(e.target.value)}
              >
                <option value="">Choose a listing...</option>
                {listings.map(l => (
                  <option key={l.id} value={l.id}>{l.address} — {fmt(l.price, true)} ({l.status})</option>
                ))}
              </select>
            </div>

            {syndicationDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {RE_PLATFORMS.map(p => {
                  const ps = syndicationDetails.platforms.find(x => x.platform === p.id) as (PlatformStatus & {
                    platform_listing_id?: string; submitted_at?: string; goes_live_at?: string;
                    expires_at?: string; notes?: string;
                  }) | undefined;
                  const status = ps?.status || 'pending';
                  const isUpdating = platformUpdating === p.id;

                  return (
                    <div key={p.id} className="bg-white rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{p.emoji}</span>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                            <Badge label={p.type.toUpperCase()} color={PLATFORM_TYPE_COLORS[p.type] || 'bg-gray-100 text-gray-600'} />
                          </div>
                        </div>
                        <StatusDot status={status} />
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Timeline: {p.timeline}</p>

                      {/* Status badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          label={status}
                          color={status === 'active' ? 'bg-green-100 text-green-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}
                        />
                        {ps?.views_count != null && <span className="text-xs text-gray-500">{ps.views_count} views · {ps.saves_count} saves · {ps.inquiries_count} inquiries</span>}
                      </div>

                      {status === 'active' && ps?.platform_url && (
                        <a href={ps.platform_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline block mb-2 truncate">{ps.platform_url}</a>
                      )}

                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={isUpdating || status === 'active'}
                          onClick={() => updatePlatform(p.id, { status: 'active', submitted_at: new Date().toISOString() })}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-40"
                        >
                          {isUpdating ? '...' : status === 'active' ? 'Live' : 'Mark Active'}
                        </button>
                        <button
                          onClick={() => {
                            const txt = syndicationDetails.listing.description || syndicationDetails.listing.title;
                            if (txt) navigator.clipboard.writeText(txt);
                          }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                        >
                          Copy Description
                        </button>
                        {status !== 'pending' && (
                          <button
                            onClick={() => updatePlatform(p.id, { status: 'pending' })}
                            className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      {/* Metrics update (if active) */}
                      {status === 'active' && (
                        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2">
                          {[
                            { key: 'views_count', label: 'Views', val: ps?.views_count ?? 0 },
                            { key: 'saves_count', label: 'Saves', val: ps?.saves_count ?? 0 },
                            { key: 'inquiries_count', label: 'Inquiries', val: ps?.inquiries_count ?? 0 },
                          ].map(({ key, label, val }) => (
                            <div key={key}>
                              <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                              <input
                                type="number"
                                className="w-full border rounded px-2 py-1 text-sm"
                                defaultValue={val}
                                onBlur={e => updatePlatform(p.id, { [key]: parseInt(e.target.value, 10) })}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!syndicationListingId && (
              <div className="bg-white rounded-xl border border-dashed p-12 text-center text-gray-400">
                Select a listing above to manage its platform syndication.
              </div>
            )}
          </div>
        )}

        {/* ====== TAB 4: AI LISTING STUDIO ====== */}
        {tab === 'ai-studio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Description Generator */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">AI Description Generator</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Property Type</label>
                      <select className="w-full border rounded px-3 py-2 text-sm" value={aiForm.property_type} onChange={e => setAiForm(f => ({ ...f, property_type: e.target.value }))}>
                        {['detached','semi_detached','townhouse','condo','apartment','land','commercial','multi_family'].map(t =>
                          <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Listing Type</label>
                      <select className="w-full border rounded px-3 py-2 text-sm" value={aiForm.listing_type} onChange={e => setAiForm(f => ({ ...f, listing_type: e.target.value }))}>
                        <option value="sale">For Sale</option>
                        <option value="lease">For Lease</option>
                        <option value="assignment">Assignment</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Address</label>
                    <input className="w-full border rounded px-3 py-2 text-sm" placeholder="123 Main St SW" value={aiForm.address} onChange={e => setAiForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Neighbourhood</label>
                    <select className="w-full border rounded px-3 py-2 text-sm" value={aiForm.neighbourhood} onChange={e => setAiForm(f => ({ ...f, neighbourhood: e.target.value }))}>
                      <option value="">Select...</option>
                      {CALGARY_NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[['bedrooms','Beds'],['bathrooms','Baths'],['sq_ft','Sq Ft'],['year_built','Year']].map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-600 mb-1">{label}</label>
                        <input className="w-full border rounded px-2 py-2 text-sm" type="number" value={(aiForm as Record<string, unknown>)[key] as string} onChange={e => setAiForm(f => ({ ...f, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Price (CAD)</label>
                    <input className="w-full border rounded px-3 py-2 text-sm" type="number" placeholder="750000" value={aiForm.price} onChange={e => setAiForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">Features</label>
                    <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto border rounded p-2">
                      {COMMON_FEATURES.slice(0, 24).map(f => (
                        <label key={f} className="flex items-center gap-1 text-xs cursor-pointer hover:text-indigo-700">
                          <input type="checkbox" checked={aiForm.features.includes(f)} onChange={() => aiToggleFeature(f)} className="rounded" />
                          <span>{f}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button onClick={generateAiDescription} disabled={aiGenerating} className="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {aiGenerating ? 'Generating with Ollama...' : 'Generate Listing Description'}
                  </button>
                </div>

                {aiDescription && (
                  <div className="mt-4 border rounded p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Generated Description</span>
                      <button onClick={() => navigator.clipboard.writeText(aiDescription)} className="text-xs text-indigo-600 hover:underline">Copy</button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{aiDescription}</p>
                    <p className="text-xs text-gray-400 mt-2">{aiDescription.length} characters · {aiDescription.split(/\s+/).length} words</p>
                  </div>
                )}
              </div>

              {/* Market Insights */}
              <div className="bg-white rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Market Pricing Insights</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Neighbourhood</label>
                    <select className="w-full border rounded px-3 py-2 text-sm" value={aiInsightNeighbourhood} onChange={e => setAiInsightNeighbourhood(e.target.value)}>
                      {CALGARY_NEIGHBOURHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Property Type</label>
                    <select className="w-full border rounded px-3 py-2 text-sm" value={aiInsightPropType} onChange={e => setAiInsightPropType(e.target.value)}>
                      {['detached','semi_detached','townhouse','condo','apartment','land','commercial','multi_family'].map(t =>
                        <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                      )}
                    </select>
                  </div>
                  <button onClick={generateAiInsights} disabled={aiInsightLoading} className="w-full py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {aiInsightLoading ? 'Analyzing Market...' : 'Get Pricing Recommendation'}
                  </button>
                </div>

                {aiInsightResult && (
                  <div className="mt-4 border rounded p-3 bg-indigo-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-indigo-700">{aiInsightNeighbourhood} — {aiInsightPropType.replace(/_/g, ' ')}</span>
                      <button onClick={() => navigator.clipboard.writeText(aiInsightResult)} className="text-xs text-indigo-600 hover:underline">Copy</button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{aiInsightResult}</p>
                  </div>
                )}

                {/* Static Calgary market reference */}
                <div className="mt-4 border rounded p-3 bg-gray-50">
                  <p className="text-xs font-medium text-gray-500 mb-2">Calgary Market Reference (2024-2025)</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between"><span>Detached Avg Price</span><span className="font-medium">$685,000</span></div>
                    <div className="flex justify-between"><span>Condo Avg Price</span><span className="font-medium">$325,000</span></div>
                    <div className="flex justify-between"><span>Townhouse Avg</span><span className="font-medium">$495,000</span></div>
                    <div className="flex justify-between"><span>Market DOM Average</span><span className="font-medium">35-45 days</span></div>
                    <div className="flex justify-between"><span>Sales-to-List Ratio</span><span className="font-medium">97-103%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====== TAB 5: LEADS & SHOWINGS ====== */}
        {tab === 'leads' && (
          <div className="space-y-4">
            {/* Stats */}
            {leadStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total Leads" value={leadStats.total} color="blue" />
                <KpiCard label="New" value={leadStats.new_leads} sub="Uncontacted" color="amber" />
                <KpiCard label="Converted" value={leadStats.converted} sub={`${leadStats.total ? ((leadStats.converted / leadStats.total) * 100).toFixed(0) : 0}% conversion`} color="green" />
                <KpiCard label="Pre-Approved" value={leadStats.pre_approved_count} sub="Ready buyers" color="purple" />
              </div>
            )}

            {/* Lead type breakdown */}
            {leadStats && (
              <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Badge label={`${leadStats.inquiries} Inquiries`} color="bg-blue-100 text-blue-700" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={`${leadStats.showings} Showings`} color="bg-purple-100 text-purple-700" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={`${leadStats.offers} Offers`} color="bg-green-100 text-green-700" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={`${leadStats.pre_approvals} Pre-Approvals`} color="bg-amber-100 text-amber-700" />
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <select className="border rounded px-3 py-2 text-sm" value={leadFilterListing} onChange={e => setLeadFilterListing(e.target.value)}>
                  <option value="">All Listings</option>
                  {listings.map(l => <option key={l.id} value={l.id}>{l.address}</option>)}
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={leadFilterPlatform} onChange={e => setLeadFilterPlatform(e.target.value)}>
                  <option value="">All Platforms</option>
                  {RE_PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={leadFilterType} onChange={e => setLeadFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="inquiry">Inquiry</option>
                  <option value="showing_request">Showing Request</option>
                  <option value="offer">Offer</option>
                  <option value="pre_approval">Pre-Approval</option>
                </select>
                <select className="border rounded px-3 py-2 text-sm" value={leadFilterStatus} onChange={e => setLeadFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="showing_scheduled">Showing Scheduled</option>
                  <option value="offer_received">Offer Received</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
                <button onClick={loadLeads} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Filter</button>
                <button onClick={() => setShowLogLead(true)} className="ml-auto px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium">+ Log Lead</button>
              </div>
            </div>

            {/* Leads table */}
            <div className="bg-white rounded-xl border overflow-hidden">
              {leads.length === 0
                ? <div className="p-12 text-center text-gray-400">No leads found.</div>
                : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Contact</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Type</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Platform</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Budget</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Pre-App'd</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map(l => {
                        const platform = RE_PLATFORMS.find(p => p.id === l.platform);
                        return (
                          <tr key={l.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('en-CA')}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {l.email && <span className="block">{l.email}</span>}
                              {l.phone && <span>{l.phone}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <Badge label={l.lead_type.replace(/_/g, ' ')} color={LEAD_TYPE_COLORS[l.lead_type] || 'bg-gray-100 text-gray-600'} />
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{platform ? `${platform.emoji} ${platform.name}` : l.platform || 'Direct'}</td>
                            <td className="px-4 py-3 text-gray-700">{fmt(l.budget, true)}</td>
                            <td className="px-4 py-3 text-center">
                              {l.pre_approved
                                ? <span className="text-green-600 font-bold text-xs">Yes</span>
                                : <span className="text-gray-300 text-xs">No</span>
                              }
                            </td>
                            <td className="px-4 py-3">
                              <select
                                className="border rounded px-2 py-1 text-xs"
                                value={l.status}
                                onChange={e => updateLeadStatus(l.id, e.target.value)}
                              >
                                {['new','contacted','showing_scheduled','offer_received','converted','lost'].map(s =>
                                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                )}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              }
            </div>
          </div>
        )}

        {/* ====== TAB 6: OPEN HOUSES ====== */}
        {tab === 'open-houses' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowAddOpenHouse(true)} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium">+ Add Open House</button>
            </div>

            {upcomingOpenHouses.length === 0
              ? (
                <div className="bg-white rounded-xl border border-dashed p-12 text-center text-gray-400">
                  <p className="text-4xl mb-3">🏠</p>
                  <p>No upcoming open houses scheduled.</p>
                  <p className="text-sm mt-1">Click &quot;Add Open House&quot; to schedule one on an active listing.</p>
                </div>
              )
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {upcomingOpenHouses.map((oh, i) => {
                    const listing = listings.find(l => l.id === oh.listing_id);
                    const dateObj = new Date(`${oh.date}T${oh.start_time || '13:00'}`);
                    const isToday = oh.date === new Date().toISOString().split('T')[0];
                    const isThisWeek = (new Date(oh.date).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;

                    return (
                      <div key={i} className={`bg-white rounded-xl border p-5 ${isToday ? 'border-green-400' : ''}`}>
                        {isToday && <Badge label="TODAY" color="bg-green-100 text-green-700" />}
                        {!isToday && isThisWeek && <Badge label="This Week" color="bg-amber-100 text-amber-700" />}
                        <p className="font-bold text-gray-800 mt-2">
                          {dateObj.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-indigo-600 font-medium text-sm">
                          {oh.start_time} – {oh.end_time}
                        </p>
                        <div className="mt-3 border-t pt-3">
                          <p className="text-sm text-gray-700 font-medium">{oh.address}</p>
                          {listing && (
                            <div className="flex gap-2 mt-1">
                              <span className="text-xs text-gray-500">{fmt(listing.price, true)}</span>
                              {listing.bedrooms && <span className="text-xs text-gray-500">{listing.bedrooms} bd</span>}
                              {listing.bathrooms && <span className="text-xs text-gray-500">{listing.bathrooms} ba</span>}
                            </div>
                          )}
                          {oh.notes && <p className="text-xs text-gray-400 mt-1 italic">{oh.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }

            {/* Past open houses */}
            {allOpenHouses.filter(oh => oh.date < new Date().toISOString().split('T')[0]).length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-600 mb-3 text-sm">Past Open Houses</h3>
                <div className="space-y-2">
                  {allOpenHouses.filter(oh => oh.date < new Date().toISOString().split('T')[0]).map((oh, i) => (
                    <div key={i} className="bg-white rounded-lg border p-3 flex items-center gap-4 text-sm opacity-60">
                      <span className="text-gray-500 w-28">{oh.date}</span>
                      <span className="text-gray-500">{oh.start_time} – {oh.end_time}</span>
                      <span className="text-gray-700 truncate">{oh.address}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateListing && (
        <CreateListingModal
          onClose={() => setShowCreateListing(false)}
          onCreated={() => { loadListings(); loadLeads(); }}
        />
      )}
      {showAddOpenHouse && (
        <AddOpenHouseModal
          listings={listings}
          onClose={() => setShowAddOpenHouse(false)}
          onSaved={loadListings}
        />
      )}
      {showLogLead && (
        <LogLeadModal
          listings={listings}
          onClose={() => setShowLogLead(false)}
          onSaved={loadLeads}
        />
      )}
    </div>
  );
}
