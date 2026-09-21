'use client';
import { useEffect, useState, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type RentalListing = {
  id: number;
  title: string;
  rental_type: string;
  address: string;
  city: string;
  province: string;
  postal_code: string | null;
  neighbourhood: string | null;
  unit_number: string | null;
  floor_number: number | null;
  monthly_rent: string | null;
  deposit_amount: string | null;
  min_lease_months: number;
  available_date: string | null;
  bedrooms: string;
  bathrooms: string | null;
  sq_ft: number | null;
  furnished: string;
  parking: string;
  pets_allowed: string;
  smoking_allowed: boolean;
  utilities_included: string[];
  amenities: string[];
  laundry: string;
  description: string | null;
  images: string[];
  virtual_tour_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  screening_requirements: string[];
  status: string;
  airbnb_enabled: boolean;
  airbnb_nightly_rate: string | null;
  airbnb_cleaning_fee: string | null;
  created_at: string;
  application_count: number;
  platform_statuses: PlatformRow[];
};

type PlatformRow = {
  id: number;
  listing_id: number;
  platform: string;
  status: string;
  platform_url: string | null;
  platform_listing_id: string | null;
  posted_at: string | null;
  expires_at: string | null;
  views_count: number;
  inquiries_count: number;
  monthly_cost: string;
  notes: string | null;
};

type Application = {
  id: number;
  listing_id: number;
  platform: string | null;
  applicant_name: string;
  email: string | null;
  phone: string | null;
  move_in_date: string | null;
  monthly_income: string | null;
  employment_status: string | null;
  num_occupants: number;
  has_pets: boolean;
  pet_details: string | null;
  message: string | null;
  screening_status: string;
  credit_score: number | null;
  references_provided: boolean;
  notes: string | null;
  created_at: string;
  address?: string;
  neighbourhood?: string;
  rental_type?: string;
};

type Tenant = {
  id: number;
  listing_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  lease_start: string | null;
  lease_end: string | null;
  monthly_rent: string | null;
  deposit_paid: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  address?: string;
  neighbourhood?: string;
};

type Stats = {
  total: number;
  active: number;
  rented: number;
  vacancy_rate: number;
  total_monthly_revenue: number;
  avg_rent: number;
  applications_pending: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const RENTAL_PLATFORMS = [
  { id: 'rentals_ca',    name: 'Rentals.ca',           emoji: '🟠', cost: 'Free basic', speciality: 'General' },
  { id: 'rentfaster',    name: 'RentFaster.ca',        emoji: '🔵', cost: 'Free',       speciality: 'Alberta #1' },
  { id: 'padmapper',     name: 'PadMapper',            emoji: '🗺️', cost: 'Free',       speciality: 'Map search' },
  { id: 'zumper',        name: 'Zumper',               emoji: '⚡', cost: 'Free/Pro',   speciality: 'Fast rental' },
  { id: 'liv_rent',      name: 'Liv.rent',             emoji: '🟢', cost: 'Free',       speciality: 'Digital lease' },
  { id: 'kijiji',        name: 'Kijiji Rentals',       emoji: '🟡', cost: 'Free',       speciality: 'High traffic' },
  { id: 'facebook',      name: 'Facebook Marketplace', emoji: '🔵', cost: 'Free',       speciality: 'Local reach' },
  { id: 'apartments_ca', name: 'Apartments.ca',        emoji: '🏢', cost: 'Paid',       speciality: 'Apartment focus' },
  { id: 'forrent_ca',    name: 'ForRent.ca',           emoji: '🏠', cost: 'Free',       speciality: 'Canada wide' },
  { id: 'airbnb',        name: 'Airbnb (Short-term)',  emoji: '🌟', cost: '3% host fee', speciality: 'Short-term/furnished' },
];

const TABS = ['dashboard', 'listings', 'syndication', 'applications', 'tenants', 'ai-studio', 'screening'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  dashboard: 'Dashboard',
  listings: 'Listings',
  syndication: 'Platform Syndication',
  applications: 'Applications',
  tenants: 'Tenant Manager',
  'ai-studio': 'AI Listing Studio',
  screening: 'Screening Tools',
};

const RENTAL_TYPES = ['apartment', 'condo', 'house', 'townhouse', 'basement_suite', 'room', 'commercial', 'short_term'];
const FURNISHED_OPTS = ['unfurnished', 'semi_furnished', 'fully_furnished'];
const PARKING_OPTS = ['none', 'outdoor', 'underground', 'titled'];
const PETS_OPTS = ['no', 'cats_only', 'small_dogs', 'all_pets', 'negotiable'];
const LAUNDRY_OPTS = ['none', 'shared', 'in_suite', 'ensuite'];
const UTILITY_OPTS = ['heat', 'water', 'electricity', 'internet', 'cable'];
const AMENITY_OPTS = ['gym', 'pool', 'concierge', 'rooftop', 'storage', 'bike_room', 'visitor_parking', 'elevator', 'security', 'courtyard'];
const SCREENING_OPTS = ['credit_check', 'employment_verification', 'references', 'id_required'];
const SCREENING_STATUSES = ['pending', 'credit_check', 'approved', 'rejected', 'waitlisted'];

const STATUS_COLORS: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-600',
  active:  'bg-green-100 text-green-700',
  rented:  'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-600',
  paused:  'bg-amber-100 text-amber-700',
};
const SCREENING_COLORS: Record<string, string> = {
  pending:      'bg-gray-100 text-gray-600',
  credit_check: 'bg-blue-100 text-blue-700',
  approved:     'bg-green-100 text-green-700',
  rejected:     'bg-red-100 text-red-600',
  waitlisted:   'bg-amber-100 text-amber-700',
};
const PLATFORM_STATUS_DOT: Record<string, string> = {
  pending:   'bg-gray-300',
  posted:    'bg-green-500',
  live:      'bg-green-500',
  paused:    'bg-amber-400',
  rejected:  'bg-red-400',
  expired:   'bg-red-300',
};

function fmt(n: number | string | null | undefined, prefix = '$'): string {
  if (n == null || n === '') return '—';
  return `${prefix}${Number(n).toLocaleString()}`;
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-CA');
}
function daysUntil(s: string | null | undefined): number | null {
  if (!s) return null;
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

// ─── Step form defaults ──────────────────────────────────────────────────────

const BLANK_LISTING = {
  title: '', rental_type: 'apartment', address: '', neighbourhood: '',
  unit_number: '', floor_number: '', postal_code: '',
  monthly_rent: '', deposit_amount: '', min_lease_months: '12',
  available_date: '', bedrooms: '1', bathrooms: '1', sq_ft: '',
  furnished: 'unfurnished', parking: 'none', pets_allowed: 'no',
  smoking_allowed: false, laundry: 'shared',
  utilities_included: [] as string[], amenities: [] as string[],
  screening_requirements: [] as string[],
  description: '', contact_name: '', contact_email: '', contact_phone: '',
  virtual_tour_url: '',
  airbnb_enabled: false, airbnb_nightly_rate: '', airbnb_cleaning_fee: '',
  platforms: RENTAL_PLATFORMS.map((p) => p.id),
  status: 'draft',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RentalPortalPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [expiringTenants, setExpiringTenants] = useState<Tenant[]>([]);
  const [rentRoll, setRentRoll] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Listing filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterNeighbourhood, setFilterNeighbourhood] = useState('');
  const [filterBeds, setFilterBeds] = useState('');
  const [filterPets, setFilterPets] = useState('');
  const [filterFurnished, setFilterFurnished] = useState('');
  const [filterMinRent, setFilterMinRent] = useState('');
  const [filterMaxRent, setFilterMaxRent] = useState('');

  // Application filters
  const [appFilterListing, setAppFilterListing] = useState('');
  const [appFilterStatus, setAppFilterStatus] = useState('');

  // Syndication
  const [syndicationListingId, setSyndicationListingId] = useState('');
  const [syndicationListing, setSyndicationListing] = useState<RentalListing | null>(null);
  const [platformEdits, setPlatformEdits] = useState<Record<string, Partial<PlatformRow>>>({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [form, setForm] = useState({ ...BLANK_LISTING });
  const [creating, setCreating] = useState(false);

  // AI Studio
  const [aiForm, setAiForm] = useState({
    rental_type: 'apartment', neighbourhood: '', bedrooms: '1', bathrooms: '1',
    sq_ft: '', furnished: 'unfurnished', amenities: [] as string[],
    monthly_rent: '', pets_allowed: 'no', utilities_included: [] as string[],
    platforms: ['rentals_ca'] as string[],
  });
  const [aiResults, setAiResults] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [pricingForm, setPricingForm] = useState({ neighbourhood: '', bedrooms: '1', rental_type: 'apartment', sq_ft: '', furnished: 'unfurnished', amenities: [] as string[] });
  const [pricingAdvice, setPricingAdvice] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<'generator' | 'pricing'>('generator');

  // Expand app detail
  const [expandedApp, setExpandedApp] = useState<number | null>(null);

  // ── Data load ──────────────────────────────────────────────────────────────

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterType)         qs.set('rental_type', filterType);
      if (filterStatus)       qs.set('status', filterStatus);
      if (filterNeighbourhood) qs.set('neighbourhood', filterNeighbourhood);
      if (filterBeds)         qs.set('bedrooms', filterBeds);
      if (filterPets)         qs.set('pets_allowed', filterPets);
      if (filterFurnished)    qs.set('furnished', filterFurnished);
      if (filterMinRent)      qs.set('min_rent', filterMinRent);
      if (filterMaxRent)      qs.set('max_rent', filterMaxRent);
      const res = await fetch(`/api/admin/rental-portal?${qs}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { listings: RentalListing[]; stats: Stats };
      setListings(data.listings);
      setStats(data.stats);
    } catch { setMsg('Failed to load listings.'); }
    finally { setLoading(false); }
  }, [filterType, filterStatus, filterNeighbourhood, filterBeds, filterPets, filterFurnished, filterMinRent, filterMaxRent]);

  const loadApplications = useCallback(async () => {
    const qs = new URLSearchParams();
    if (appFilterListing) qs.set('listing_id', appFilterListing);
    if (appFilterStatus)  qs.set('screening_status', appFilterStatus);
    const res = await fetch(`/api/admin/rental-portal/applications?${qs}`);
    if (res.ok) {
      const d = await res.json() as { applications: Application[] };
      setApplications(d.applications);
    }
  }, [appFilterListing, appFilterStatus]);

  const loadTenants = useCallback(async () => {
    const res  = await fetch('/api/admin/rental-portal/tenants');
    const expR = await fetch('/api/admin/rental-portal/tenants?expiring=60');
    if (res.ok)  { const d = await res.json() as { tenants: Tenant[]; rent_roll: number }; setTenants(d.tenants); setRentRoll(d.rent_roll); }
    if (expR.ok) { const d = await expR.json() as { tenants: Tenant[] }; setExpiringTenants(d.tenants); }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);
  useEffect(() => { if (tab === 'applications') loadApplications(); }, [tab, loadApplications]);
  useEffect(() => { if (tab === 'tenants') loadTenants(); }, [tab, loadTenants]);

  // ── Syndication listing load ───────────────────────────────────────────────

  useEffect(() => {
    if (!syndicationListingId) { setSyndicationListing(null); return; }
    fetch(`/api/admin/rental-portal/${syndicationListingId}`)
      .then((r) => r.json() as Promise<{ listing: RentalListing; platforms: PlatformRow[] }>)
      .then((d) => {
        setSyndicationListing({ ...d.listing, platform_statuses: d.platforms });
      })
      .catch(() => null);
  }, [syndicationListingId]);

  // ── Create listing ────────────────────────────────────────────────────────

  async function submitCreate() {
    setCreating(true);
    try {
      const body = {
        ...form,
        floor_number: form.floor_number ? Number(form.floor_number) : null,
        monthly_rent: form.monthly_rent ? Number(form.monthly_rent) : null,
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
        min_lease_months: Number(form.min_lease_months),
        bedrooms: Number(form.bedrooms),
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sq_ft: form.sq_ft ? Number(form.sq_ft) : null,
        airbnb_nightly_rate: form.airbnb_nightly_rate ? Number(form.airbnb_nightly_rate) : null,
        airbnb_cleaning_fee: form.airbnb_cleaning_fee ? Number(form.airbnb_cleaning_fee) : null,
      };
      const res = await fetch('/api/admin/rental-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      setShowCreate(false);
      setForm({ ...BLANK_LISTING });
      setCreateStep(1);
      setMsg('Listing created and syndicated to all selected platforms.');
      loadListings();
    } catch { setMsg('Failed to create listing.'); }
    finally { setCreating(false); }
  }

  // ── Platform update ───────────────────────────────────────────────────────

  async function savePlatform(listingId: number, platform: string, patch: Partial<PlatformRow>) {
    await fetch(`/api/admin/rental-portal/${listingId}/platform/${platform}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    // Reload syndication data
    const res = await fetch(`/api/admin/rental-portal/${listingId}`);
    if (res.ok) {
      const d = await res.json() as { listing: RentalListing; platforms: PlatformRow[] };
      setSyndicationListing({ ...d.listing, platform_statuses: d.platforms });
    }
  }

  async function markPosted(listingId: number, platform: string) {
    await savePlatform(listingId, platform, { status: 'posted', posted_at: new Date().toISOString() });
  }

  // ── Application screening ─────────────────────────────────────────────────

  async function screenApp(id: number, patch: Partial<Application>) {
    await fetch(`/api/admin/rental-portal/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    loadApplications();
  }

  async function convertToTenant(app: Application) {
    const listing = listings.find((l) => l.id === app.listing_id);
    const payload = {
      listing_id: app.listing_id,
      name: app.applicant_name,
      email: app.email,
      phone: app.phone,
      lease_start: app.move_in_date,
      monthly_rent: listing?.monthly_rent,
    };
    const res = await fetch('/api/admin/rental-portal/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setMsg('Tenant record created.'); loadTenants(); }
  }

  // ── AI generation ─────────────────────────────────────────────────────────

  async function generateListingCopy() {
    setAiLoading(true);
    const results: Record<string, string> = {};
    for (const platform of aiForm.platforms) {
      try {
        const res = await fetch('/api/admin/rental-portal/generate-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...aiForm, platform }),
        });
        if (res.ok) {
          const d = await res.json() as { description: string };
          results[platform] = d.description;
        }
      } catch { results[platform] = '[Generation failed — check Ollama connection]'; }
    }
    setAiResults(results);
    setAiLoading(false);
  }

  async function generatePricing() {
    setPricingLoading(true);
    try {
      const res = await fetch('/api/admin/rental-portal/pricing-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingForm),
      });
      const d = await res.json() as { advice: string };
      setPricingAdvice(d.advice);
    } catch { setPricingAdvice('[Failed to connect to Ollama — check local AI server]'); }
    finally { setPricingLoading(false); }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  function getPlatformRow(listing: RentalListing, platformId: string): PlatformRow | undefined {
    return listing.platform_statuses?.find((p) => p.platform === platformId);
  }

  function platformDotColor(listing: RentalListing, platformId: string): string {
    const row = getPlatformRow(listing, platformId);
    if (!row) return 'bg-gray-200';
    return PLATFORM_STATUS_DOT[row.status] ?? 'bg-gray-300';
  }

  // ── Render tab contents ───────────────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Metric cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: 'Total Units',       value: stats.total, color: 'bg-slate-800 text-white' },
            { label: 'Vacant (Active)',    value: stats.active, color: 'bg-green-50 text-green-700' },
            { label: 'Rented',            value: stats.rented, color: 'bg-blue-50 text-blue-700' },
            { label: 'Vacancy Rate',      value: `${stats.vacancy_rate}%`, color: 'bg-amber-50 text-amber-700' },
            { label: 'Monthly Revenue',   value: fmt(stats.total_monthly_revenue), color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Avg Rent',          value: fmt(stats.avg_rent), color: 'bg-purple-50 text-purple-700' },
            { label: 'Pending Apps',      value: stats.applications_pending, color: 'bg-orange-50 text-orange-700' },
          ].map((m) => (
            <div key={m.label} className={`rounded-xl p-4 ${m.color}`}>
              <div className="text-xs font-medium opacity-70">{m.label}</div>
              <div className="text-2xl font-bold mt-1">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Expiring leases alert */}
      {expiringTenants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-amber-800 mb-2">
            ⚠ {expiringTenants.length} lease{expiringTenants.length > 1 ? 's' : ''} expiring within 60 days
          </div>
          <div className="space-y-1">
            {expiringTenants.map((t) => (
              <div key={t.id} className="flex items-center gap-4 text-sm text-amber-900">
                <span className="font-medium">{t.name}</span>
                <span className="text-amber-600">{t.address}</span>
                <span className="ml-auto font-semibold">{fmtDate(t.lease_end)} ({daysUntil(t.lease_end)} days)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform coverage matrix */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Platform Coverage Matrix</h3>
        {listings.length === 0 ? (
          <p className="text-gray-500 text-sm">No listings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 pr-4 font-medium text-gray-500 min-w-[140px]">Listing</th>
                  {RENTAL_PLATFORMS.map((p) => (
                    <th key={p.id} className="pb-2 px-2 font-medium text-gray-500 text-center min-w-[70px]">
                      <div>{p.emoji}</div>
                      <div className="truncate max-w-[60px]">{p.name.split(' ')[0]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-700 truncate max-w-[140px]">
                      {l.address}
                    </td>
                    {RENTAL_PLATFORMS.map((p) => {
                      const row = getPlatformRow(l, p.id);
                      const color = row ? (PLATFORM_STATUS_DOT[row.status] ?? 'bg-gray-300') : 'bg-gray-100';
                      return (
                        <td key={p.id} className="py-2 px-2 text-center">
                          <span className={`inline-block w-3 h-3 rounded-full ${color}`} title={row?.status ?? 'not set'} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1" />Posted/Live</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 mr-1" />Pending</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1" />Paused</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-1" />Rejected/Expired</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-100 mr-1" />Not configured</span>
        </div>
      </div>

      {/* Revenue chart */}
      {listings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Rent Roll by Type</h3>
          {(() => {
            const byType: Record<string, number> = {};
            listings.filter((l) => l.status === 'rented' && l.monthly_rent).forEach((l) => {
              byType[l.rental_type] = (byType[l.rental_type] ?? 0) + Number(l.monthly_rent);
            });
            const entries = Object.entries(byType);
            if (!entries.length) return <p className="text-sm text-gray-500">No rented units yet.</p>;
            const max = Math.max(...entries.map(([, v]) => v));
            return (
              <div className="space-y-2">
                {entries.map(([type, total]) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-gray-600 capitalize">{type.replace(/_/g, ' ')}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5">
                      <div
                        className="bg-slate-700 h-5 rounded-full transition-all"
                        style={{ width: `${Math.round((total / max) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-gray-700 w-20 text-right">{fmt(total)}/mo</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );

  const renderListings = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Types</option>
            {RENTAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            {['draft','active','rented','expired','paused'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={filterNeighbourhood} onChange={(e) => setFilterNeighbourhood(e.target.value)}
            placeholder="Neighbourhood" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <select value={filterBeds} onChange={(e) => setFilterBeds(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Any beds</option>
            {['0','1','2','3','4'].map((b) => <option key={b} value={b}>{b === '0' ? 'Studio' : `${b} bed`}</option>)}
          </select>
          <select value={filterPets} onChange={(e) => setFilterPets(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Pets: Any</option>
            {PETS_OPTS.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filterFurnished} onChange={(e) => setFilterFurnished(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Furnished: Any</option>
            {FURNISHED_OPTS.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
          </select>
          <input value={filterMinRent} onChange={(e) => setFilterMinRent(e.target.value)}
            placeholder="Min rent $" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" type="number" />
          <input value={filterMaxRent} onChange={(e) => setFilterMaxRent(e.target.value)}
            placeholder="Max rent $" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" type="number" />
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={loadListings} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">
            Search
          </button>
          <button onClick={() => {
            setFilterType(''); setFilterStatus(''); setFilterNeighbourhood('');
            setFilterBeds(''); setFilterPets(''); setFilterFurnished('');
            setFilterMinRent(''); setFilterMaxRent('');
          }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Clear
          </button>
          <button onClick={() => { setShowCreate(true); setCreateStep(1); }}
            className="ml-auto px-4 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-600">
            + Create Listing
          </button>
        </div>
      </div>

      {/* Listing cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading listings…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No listings found. Create your first rental listing.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {listings.map((l) => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-gray-800 text-sm truncate max-w-[180px]">{l.address}</div>
                  <div className="text-xs text-gray-500">{l.neighbourhood ?? l.city}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {l.status}
                </span>
              </div>

              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-xl font-bold text-gray-900">{fmt(l.monthly_rent)}</span>
                <span className="text-sm text-gray-500">/mo</span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
                <span>{Number(l.bedrooms) === 0 ? 'Studio' : `${l.bedrooms} bd`}</span>
                <span>·</span>
                <span>{l.bathrooms ? `${l.bathrooms} ba` : '—'}</span>
                {l.sq_ft && <><span>·</span><span>{l.sq_ft} sqft</span></>}
                {l.furnished !== 'unfurnished' && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full capitalize">
                    {l.furnished.replace(/_/g, ' ')}
                  </span>
                )}
                {l.pets_allowed !== 'no' && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pets OK</span>
                )}
              </div>

              <div className="text-xs text-gray-500 mb-3">
                Available: {fmtDate(l.available_date)} · {l.application_count} app{l.application_count !== 1 ? 's' : ''}
              </div>

              {/* Platform dots */}
              <div className="flex gap-1 flex-wrap">
                {RENTAL_PLATFORMS.map((p) => (
                  <div
                    key={p.id}
                    title={`${p.name}: ${getPlatformRow(l, p.id)?.status ?? 'pending'}`}
                    className={`w-3.5 h-3.5 rounded-full border border-white ${platformDotColor(l, p.id)}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSyndication = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-medium text-gray-700 mr-3">Select Listing:</label>
        <select
          value={syndicationListingId}
          onChange={(e) => setSyndicationListingId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72"
        >
          <option value="">— Choose a listing —</option>
          {listings.map((l) => (
            <option key={l.id} value={String(l.id)}>{l.address} ({l.neighbourhood ?? l.city})</option>
          ))}
        </select>
      </div>

      {syndicationListing && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {RENTAL_PLATFORMS.map((p) => {
            const row = getPlatformRow(syndicationListing, p.id);
            const edit = platformEdits[p.id] ?? {};

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm text-gray-800">{p.emoji} {p.name}</div>
                  <div className="flex gap-1">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{p.cost}</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{p.speciality}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1 mb-3">
                  <div>Status: <span className="font-medium capitalize">{row?.status ?? 'pending'}</span></div>
                  {row?.posted_at && <div>Posted: {fmtDate(row.posted_at)}</div>}
                  {row?.expires_at && <div>Expires: {fmtDate(row.expires_at)}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-xs text-gray-500">Views</label>
                    <input
                      type="number"
                      defaultValue={row?.views_count ?? 0}
                      onChange={(e) => setPlatformEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], views_count: Number(e.target.value) } }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Inquiries</label>
                    <input
                      type="number"
                      defaultValue={row?.inquiries_count ?? 0}
                      onChange={(e) => setPlatformEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], inquiries_count: Number(e.target.value) } }))}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm mt-0.5"
                    />
                  </div>
                </div>

                <input
                  type="url"
                  placeholder="Listing URL on this platform"
                  defaultValue={row?.platform_url ?? ''}
                  onChange={(e) => setPlatformEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], platform_url: e.target.value } }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm mb-2"
                />

                {p.cost !== 'Free' && p.cost !== 'Free basic' && (
                  <input
                    type="number"
                    placeholder="Monthly cost ($)"
                    defaultValue={row?.monthly_cost ?? ''}
                    onChange={(e) => setPlatformEdits((prev) => ({ ...prev, [p.id]: { ...prev[p.id], monthly_cost: e.target.value } }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm mb-2"
                  />
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => markPosted(syndicationListing.id, p.id)}
                    className="flex-1 text-xs py-1.5 bg-green-700 text-white rounded-lg hover:bg-green-600"
                  >
                    Mark Posted
                  </button>
                  <button
                    onClick={() => savePlatform(syndicationListing.id, p.id, { ...edit })}
                    className="flex-1 text-xs py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!syndicationListingId && (
        <div className="text-center py-12 text-gray-400">Select a listing above to manage its platform syndication.</div>
      )}
    </div>
  );

  const renderApplications = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-3 flex-wrap">
        <select value={appFilterListing} onChange={(e) => setAppFilterListing(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Listings</option>
          {listings.map((l) => <option key={l.id} value={String(l.id)}>{l.address}</option>)}
        </select>
        <select value={appFilterStatus} onChange={(e) => setAppFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {SCREENING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <button onClick={loadApplications} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">Filter</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date','Applicant','Contact','Listing','Move-in','Income','Occ.','Pets','Status','Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr><td colSpan={10} className="py-8 text-center text-gray-400">No applications found.</td></tr>
            ) : applications.map((a) => (
              <>
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedApp(expandedApp === a.id ? null : a.id)}>
                  <td className="py-3 px-4 text-xs text-gray-500">{fmtDate(a.created_at)}</td>
                  <td className="py-3 px-4 font-medium text-gray-800">{a.applicant_name}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{a.email ?? '—'}</td>
                  <td className="py-3 px-4 text-xs text-gray-600 max-w-[120px] truncate">{a.address ?? `#${a.listing_id}`}</td>
                  <td className="py-3 px-4 text-xs">{fmtDate(a.move_in_date)}</td>
                  <td className="py-3 px-4 text-xs">{fmt(a.monthly_income)}</td>
                  <td className="py-3 px-4 text-xs text-center">{a.num_occupants}</td>
                  <td className="py-3 px-4 text-xs">{a.has_pets ? 'Yes' : 'No'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCREENING_COLORS[a.screening_status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {a.screening_status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {SCREENING_STATUSES.filter((s) => s !== a.screening_status).slice(0, 2).map((s) => (
                        <button key={s} onClick={(e) => { e.stopPropagation(); screenApp(a.id, { screening_status: s }); }}
                          className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-100 capitalize">
                          {s.replace(/_/g, ' ')}
                        </button>
                      ))}
                      {a.screening_status === 'approved' && (
                        <button onClick={(e) => { e.stopPropagation(); convertToTenant(a); }}
                          className="text-xs px-2 py-0.5 bg-blue-700 text-white rounded hover:bg-blue-600">
                          → Tenant
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedApp === a.id && (
                  <tr key={`${a.id}-expand`} className="bg-blue-50">
                    <td colSpan={10} className="px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-gray-500">Employment:</span> {a.employment_status ?? '—'}</div>
                        <div><span className="text-gray-500">Credit Score:</span> {a.credit_score ?? '—'}</div>
                        <div><span className="text-gray-500">Refs Provided:</span> {a.references_provided ? 'Yes' : 'No'}</div>
                        <div><span className="text-gray-500">Platform:</span> {a.platform ?? '—'}</div>
                        {a.pet_details && <div className="col-span-2"><span className="text-gray-500">Pet details:</span> {a.pet_details}</div>}
                        {a.message && <div className="col-span-4"><span className="text-gray-500">Message:</span> {a.message}</div>}
                        {a.notes && <div className="col-span-4"><span className="text-gray-500">Notes:</span> {a.notes}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTenants = () => (
    <div className="space-y-4">
      {/* Rent roll summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="text-xs text-emerald-600 font-medium">Active Rent Roll</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{fmt(rentRoll)}/mo</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-xs text-amber-600 font-medium">Expiring (60 days)</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{expiringTenants.length}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-xs text-blue-600 font-medium">Total Tenants</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{tenants.length}</div>
        </div>
      </div>

      {/* Expiring leases */}
      {expiringTenants.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <h3 className="font-semibold text-amber-800 mb-3">Leases Expiring in 60 Days</h3>
          <div className="space-y-2">
            {expiringTenants.map((t) => {
              const d = daysUntil(t.lease_end);
              const urgency = d !== null && d <= 30 ? 'text-red-600 font-bold' : 'text-amber-700';
              return (
                <div key={t.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.address}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm ${urgency}`}>{fmtDate(t.lease_end)}</div>
                    <div className="text-xs text-gray-500">{d} days left</div>
                  </div>
                  <button className="ml-4 text-xs px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50">
                    Send Reminder
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name','Contact','Listing','Lease Start','Lease End','Rent','Deposit','Status'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400">No tenant records.</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-800">{t.name}</td>
                <td className="py-3 px-4 text-xs text-gray-500">{t.email ?? '—'}<br />{t.phone ?? ''}</td>
                <td className="py-3 px-4 text-xs text-gray-600 truncate max-w-[120px]">{t.address ?? `#${t.listing_id}`}</td>
                <td className="py-3 px-4 text-xs">{fmtDate(t.lease_start)}</td>
                <td className="py-3 px-4 text-xs">{fmtDate(t.lease_end)}</td>
                <td className="py-3 px-4 text-xs font-medium">{fmt(t.monthly_rent)}</td>
                <td className="py-3 px-4 text-xs">{fmt(t.deposit_paid)}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAiStudio = () => (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        {(['generator', 'pricing'] as const).map((s) => (
          <button key={s} onClick={() => setAiSubTab(s)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${aiSubTab === s ? 'bg-white border border-b-white border-gray-200 text-slate-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {s === 'generator' ? 'Listing Copy Generator' : 'Pricing Advisor'}
          </button>
        ))}
      </div>

      {aiSubTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Listing Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Rental Type</label>
                <select value={aiForm.rental_type} onChange={(e) => setAiForm((f) => ({ ...f, rental_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {RENTAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Neighbourhood</label>
                <input value={aiForm.neighbourhood} onChange={(e) => setAiForm((f) => ({ ...f, neighbourhood: e.target.value }))}
                  placeholder="e.g. Beltline" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Bedrooms</label>
                <select value={aiForm.bedrooms} onChange={(e) => setAiForm((f) => ({ ...f, bedrooms: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {['0','1','2','3','4'].map((b) => <option key={b} value={b}>{b === '0' ? 'Studio' : b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Bathrooms</label>
                <input value={aiForm.bathrooms} onChange={(e) => setAiForm((f) => ({ ...f, bathrooms: e.target.value }))}
                  placeholder="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" type="number" step="0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Sq Ft</label>
                <input value={aiForm.sq_ft} onChange={(e) => setAiForm((f) => ({ ...f, sq_ft: e.target.value }))}
                  placeholder="750" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" type="number" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Monthly Rent</label>
                <input value={aiForm.monthly_rent} onChange={(e) => setAiForm((f) => ({ ...f, monthly_rent: e.target.value }))}
                  placeholder="1800" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" type="number" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Furnished</label>
                <select value={aiForm.furnished} onChange={(e) => setAiForm((f) => ({ ...f, furnished: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {FURNISHED_OPTS.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Pets</label>
                <select value={aiForm.pets_allowed} onChange={(e) => setAiForm((f) => ({ ...f, pets_allowed: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {PETS_OPTS.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Amenities</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {AMENITY_OPTS.map((a) => (
                  <button key={a} onClick={() => setAiForm((f) => ({ ...f, amenities: toggleArr(f.amenities, a) }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${aiForm.amenities.includes(a) ? 'bg-slate-800 text-white border-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Utilities Included</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {UTILITY_OPTS.map((u) => (
                  <button key={u} onClick={() => setAiForm((f) => ({ ...f, utilities_included: toggleArr(f.utilities_included, u) }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${aiForm.utilities_included.includes(u) ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Generate for platforms:</label>
              <div className="flex flex-wrap gap-1">
                {RENTAL_PLATFORMS.map((p) => (
                  <button key={p.id} onClick={() => setAiForm((f) => ({ ...f, platforms: toggleArr(f.platforms, p.id) }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${aiForm.platforms.includes(p.id) ? 'bg-slate-800 text-white border-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {p.emoji} {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generateListingCopy}
              disabled={aiLoading || !aiForm.neighbourhood}
              className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {aiLoading ? 'Generating…' : 'Generate Listing Copy'}
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-3">
            {Object.keys(aiResults).length === 0 && !aiLoading && (
              <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
                Fill in the details and click Generate to create platform-specific listing copy.
              </div>
            )}
            {aiLoading && (
              <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
                Generating copy via Ollama local AI…
              </div>
            )}
            {Object.entries(aiResults).map(([platformId, description]) => {
              const meta = RENTAL_PLATFORMS.find((p) => p.id === platformId);
              return (
                <div key={platformId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-800">{meta?.emoji} {meta?.name}</div>
                    <button
                      onClick={() => navigator.clipboard.writeText(description)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {aiSubTab === 'pricing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Pricing Advisor — Calgary Market</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Neighbourhood</label>
                <input value={pricingForm.neighbourhood} onChange={(e) => setPricingForm((f) => ({ ...f, neighbourhood: e.target.value }))}
                  placeholder="e.g. Mission" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Rental Type</label>
                <select value={pricingForm.rental_type} onChange={(e) => setPricingForm((f) => ({ ...f, rental_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {RENTAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Bedrooms</label>
                <select value={pricingForm.bedrooms} onChange={(e) => setPricingForm((f) => ({ ...f, bedrooms: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {['0','1','2','3','4'].map((b) => <option key={b} value={b}>{b === '0' ? 'Studio' : b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Sq Ft</label>
                <input value={pricingForm.sq_ft} onChange={(e) => setPricingForm((f) => ({ ...f, sq_ft: e.target.value }))}
                  placeholder="750" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" type="number" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Furnished</label>
                <select value={pricingForm.furnished} onChange={(e) => setPricingForm((f) => ({ ...f, furnished: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                  {FURNISHED_OPTS.map((f) => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Amenities</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {AMENITY_OPTS.map((a) => (
                  <button key={a} onClick={() => setPricingForm((f) => ({ ...f, amenities: toggleArr(f.amenities, a) }))}
                    className={`text-xs px-2 py-0.5 rounded-full border ${pricingForm.amenities.includes(a) ? 'bg-slate-800 text-white border-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {a.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generatePricing}
              disabled={pricingLoading || !pricingForm.neighbourhood}
              className="w-full py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {pricingLoading ? 'Analysing…' : 'Get Pricing Advice'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {pricingAdvice ? (
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{pricingAdvice}</div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                Enter neighbourhood and property details to get AI-powered Calgary rental market pricing advice.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderScreening = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Tenant Screening Checklist (Alberta)</h3>
        <div className="space-y-3">
          {[
            { item: 'Government-issued photo ID', detail: 'Driver\'s licence, passport, or provincial ID' },
            { item: 'Credit check authorization', detail: 'Signed consent — use Equifax/TransUnion; $20-40 charge is lawful in AB' },
            { item: 'Employment letter', detail: 'On company letterhead, signed by employer' },
            { item: 'Pay stubs (2 most recent)', detail: 'Confirm gross monthly income ≥ 3× monthly rent' },
            { item: 'Previous landlord references (2)', detail: 'Name, phone, tenancy dates, reason for leaving' },
            { item: 'Bank statement (most recent)', detail: 'To verify deposit availability and spending patterns' },
            { item: 'Rental application form', detail: 'Signed, dated application with consent clause' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-5 h-5 rounded border-2 border-gray-300 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-800">{s.item}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legal notes + scoring */}
      <div className="space-y-5">
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-blue-900 mb-3">AB/BC Screening Law (Educational)</h3>
          <div className="space-y-2 text-sm text-blue-900">
            <p><strong>Alberta RTAL:</strong> Landlords may screen applicants but cannot refuse based on protected grounds (race, gender, disability, source of income, family status under AHRA).</p>
            <p><strong>Credit Checks:</strong> You must have written consent before running a credit check. You can charge a reasonable fee (typically up to $25-$50).</p>
            <p><strong>Pets:</strong> Alberta does not prohibit pet clauses in leases. Pet damage deposits are separate from security deposits.</p>
            <p><strong>Smoking:</strong> Landlords may prohibit smoking in leases. Cannabis prohibition clauses are enforceable.</p>
            <p><strong>Privacy:</strong> Collected personal data must be handled per PIPA (Alberta Personal Information Protection Act).</p>
            <p className="text-xs text-blue-600 mt-2">This is educational information only — not legal advice. Consult RTDRS or a lawyer for specific situations.</p>
          </div>
        </div>

        {/* Applicant scoring matrix */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Applicant Scoring Matrix</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Income Ratio', help: 'Gross income ÷ rent (target ≥ 3×)', max: 30 },
              { label: 'Credit Tier',  help: '750+ Excellent / 700-749 Good / 650-699 Fair / <650 Poor', max: 30 },
              { label: 'Rental History', help: 'Landlord references quality & tenancy length', max: 25 },
              { label: 'References',  help: 'Quality and verifiability of personal/professional refs', max: 15 },
            ].map((row) => (
              <div key={row.label} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">{row.label}</span>
                  <span className="text-xs text-gray-500">Max: {row.max} pts</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{row.help}</div>
              </div>
            ))}
            <div className="bg-slate-800 text-white rounded-lg p-3 text-center font-semibold">
              Total: /100 — 80+ Approve · 60-79 Review · &lt;60 Consider rejecting
            </div>
          </div>
        </div>

        {/* Red flags */}
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <h3 className="font-semibold text-red-800 mb-3">Red Flags (Educational)</h3>
          <ul className="text-sm text-red-900 space-y-1.5 list-disc list-inside">
            <li>Refuses to provide ID or employment verification</li>
            <li>Cannot explain gaps in rental history</li>
            <li>Income ≤ 2.5× monthly rent with no co-signer</li>
            <li>Eviction on record in last 3 years</li>
            <li>Previous landlord references unavailable or unverifiable</li>
            <li>Pressure to skip screening steps or move in immediately</li>
            <li>Offers more than asking rent without seeing the unit</li>
          </ul>
          <p className="text-xs text-red-600 mt-3">Red flags are screening indicators, not automatic grounds for rejection. Base decisions on objective, verifiable criteria to comply with fair housing rules.</p>
        </div>
      </div>
    </div>
  );

  // ── Create listing modal ──────────────────────────────────────────────────

  const renderCreateModal = () => {
    const step = createStep;
    const totalSteps = 6;

    const stepContent = () => {
      if (step === 1) return (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800">Step 1: Property Type & Location</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Modern 2BR Condo in Beltline" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Rental Type</label>
              <select value={form.rental_type} onChange={(e) => setForm((f) => ({ ...f, rental_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {RENTAL_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Street Address</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="e.g. 1234 5 Ave SW" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Neighbourhood</label>
              <input value={form.neighbourhood} onChange={(e) => setForm((f) => ({ ...f, neighbourhood: e.target.value }))}
                placeholder="e.g. Beltline" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Postal Code</label>
              <input value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                placeholder="T2P 1A1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Unit #</label>
              <input value={form.unit_number} onChange={(e) => setForm((f) => ({ ...f, unit_number: e.target.value }))}
                placeholder="202" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Floor</label>
              <input value={form.floor_number} onChange={(e) => setForm((f) => ({ ...f, floor_number: e.target.value }))}
                placeholder="2" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
          </div>
        </div>
      );

      if (step === 2) return (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800">Step 2: Pricing & Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Monthly Rent ($)</label>
              <input value={form.monthly_rent} onChange={(e) => setForm((f) => ({ ...f, monthly_rent: e.target.value }))}
                placeholder="1800" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Security Deposit ($)</label>
              <input value={form.deposit_amount} onChange={(e) => setForm((f) => ({ ...f, deposit_amount: e.target.value }))}
                placeholder="1800" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Min Lease (months)</label>
              <input value={form.min_lease_months} onChange={(e) => setForm((f) => ({ ...f, min_lease_months: e.target.value }))}
                placeholder="12" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Available Date</label>
              <input value={form.available_date} onChange={(e) => setForm((f) => ({ ...f, available_date: e.target.value }))}
                type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Bedrooms</label>
              <select value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {['0','1','2','3','4','5'].map((b) => <option key={b} value={b}>{b === '0' ? 'Studio/Bachelor' : b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Bathrooms</label>
              <input value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                placeholder="1" type="number" step="0.5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Square Feet</label>
              <input value={form.sq_ft} onChange={(e) => setForm((f) => ({ ...f, sq_ft: e.target.value }))}
                placeholder="750" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
          </div>
        </div>
      );

      if (step === 3) return (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800">Step 3: Features & Pet/Smoking Policy</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Furnished</label>
              <select value={form.furnished} onChange={(e) => setForm((f) => ({ ...f, furnished: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {FURNISHED_OPTS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Parking</label>
              <select value={form.parking} onChange={(e) => setForm((f) => ({ ...f, parking: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {PARKING_OPTS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Pets Allowed</label>
              <select value={form.pets_allowed} onChange={(e) => setForm((f) => ({ ...f, pets_allowed: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {PETS_OPTS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Laundry</label>
              <select value={form.laundry} onChange={(e) => setForm((f) => ({ ...f, laundry: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
                {LAUNDRY_OPTS.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="smoking" checked={form.smoking_allowed}
                onChange={(e) => setForm((f) => ({ ...f, smoking_allowed: e.target.checked }))}
                className="rounded" />
              <label htmlFor="smoking" className="text-sm text-gray-700">Smoking Allowed</label>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Utilities Included</label>
            <div className="flex flex-wrap gap-2">
              {UTILITY_OPTS.map((u) => (
                <button key={u} type="button"
                  onClick={() => setForm((f) => ({ ...f, utilities_included: toggleArr(f.utilities_included, u) }))}
                  className={`text-xs px-3 py-1.5 rounded-full border ${form.utilities_included.includes(u) ? 'bg-blue-700 text-white border-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

      if (step === 4) return (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Step 4: Amenities & Screening Requirements</h3>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Building Amenities</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTS.map((a) => (
                <button key={a} type="button"
                  onClick={() => setForm((f) => ({ ...f, amenities: toggleArr(f.amenities, a) }))}
                  className={`text-xs px-3 py-1.5 rounded-full border ${form.amenities.includes(a) ? 'bg-slate-800 text-white border-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {a.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Screening Requirements</label>
            <div className="flex flex-wrap gap-2">
              {SCREENING_OPTS.map((s) => (
                <button key={s} type="button"
                  onClick={() => setForm((f) => ({ ...f, screening_requirements: toggleArr(f.screening_requirements, s) }))}
                  className={`text-xs px-3 py-1.5 rounded-full border ${form.screening_requirements.includes(s) ? 'bg-orange-700 text-white border-orange-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

      if (step === 5) return (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800">Step 5: Description & Contact</h3>
          <div>
            <label className="text-xs text-gray-500">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={6} placeholder="Describe the property…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5 resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Contact Name</label>
              <input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Contact Email</label>
              <input value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Contact Phone</label>
              <input value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Virtual Tour URL</label>
            <input value={form.virtual_tour_url} onChange={(e) => setForm((f) => ({ ...f, virtual_tour_url: e.target.value }))}
              placeholder="https://…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
          </div>
        </div>
      );

      if (step === 6) return (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800">Step 6: Platform Selection & Airbnb Settings</h3>
          <div>
            <label className="text-xs text-gray-500 block mb-2">Syndicate to platforms:</label>
            <div className="grid grid-cols-2 gap-2">
              {RENTAL_PLATFORMS.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => setForm((f) => ({ ...f, platforms: toggleArr(f.platforms, p.id) }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left ${form.platforms.includes(p.id) ? 'bg-slate-800 text-white border-slate-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  <span>{p.emoji}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className={`text-xs ${form.platforms.includes(p.id) ? 'opacity-70' : 'text-gray-400'}`}>{p.cost}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="airbnb_enabled" checked={form.airbnb_enabled}
              onChange={(e) => setForm((f) => ({ ...f, airbnb_enabled: e.target.checked }))}
              className="rounded" />
            <label htmlFor="airbnb_enabled" className="text-sm text-gray-700">Enable Airbnb short-term settings</label>
          </div>
          {form.airbnb_enabled && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div>
                <label className="text-xs text-gray-500">Nightly Rate ($)</label>
                <input value={form.airbnb_nightly_rate} onChange={(e) => setForm((f) => ({ ...f, airbnb_nightly_rate: e.target.value }))}
                  placeholder="120" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Cleaning Fee ($)</label>
                <input value={form.airbnb_cleaning_fee} onChange={(e) => setForm((f) => ({ ...f, airbnb_cleaning_fee: e.target.value }))}
                  placeholder="75" type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500">Initial Status</label>
            <select value={form.status ?? 'draft'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-0.5">
              {['draft','active'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      );

      return null;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Create Rental Listing</h2>
              <div className="text-xs text-gray-500 mt-0.5">Step {step} of {totalSteps}</div>
            </div>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pt-3">
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-slate-800' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>

          <div className="p-6">{stepContent()}</div>

          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => setCreateStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              Back
            </button>
            {step < totalSteps ? (
              <button
                onClick={() => setCreateStep((s) => s + 1)}
                disabled={step === 1 && (!form.title || !form.address)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitCreate}
                disabled={creating}
                className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-40"
              >
                {creating ? 'Creating…' : 'Create & Syndicate'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Rental Portal Hub</h1>
            <p className="text-slate-400 text-sm mt-0.5">Calgary/Alberta — 10 platforms · Unified listing management</p>
          </div>
          <div className="flex items-center gap-2">
            {RENTAL_PLATFORMS.slice(0, 5).map((p) => (
              <span key={p.id} title={p.name} className="text-lg">{p.emoji}</span>
            ))}
            <span className="text-slate-400 text-sm">+5 more</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-screen-2xl mx-auto flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className="max-w-screen-2xl mx-auto mt-4 px-6">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-blue-500 hover:text-blue-700 ml-4">×</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {tab === 'dashboard'     && renderDashboard()}
        {tab === 'listings'      && renderListings()}
        {tab === 'syndication'   && renderSyndication()}
        {tab === 'applications'  && renderApplications()}
        {tab === 'tenants'       && renderTenants()}
        {tab === 'ai-studio'     && renderAiStudio()}
        {tab === 'screening'     && renderScreening()}
      </div>

      {/* Create modal */}
      {showCreate && renderCreateModal()}
    </div>
  );
}
