'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DigitalCard = {
  id: string;
  slug: string;
  card_type: string;
  owner_name: string;
  job_title: string | null;
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  website_url: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  github_url: string | null;
  pinterest_url: string | null;
  snapchat_url: string | null;
  threads_url: string | null;
  calendly_url: string | null;
  zoom_link: string | null;
  google_meet_url: string | null;
  shopify_url: string | null;
  etsy_url: string | null;
  amazon_store_url: string | null;
  theme: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  layout: string;
  view_count: number;
  click_count: number;
  share_count: number;
  save_count: number;
  is_active: boolean;
  show_qr_on_card: boolean;
  allow_contact_form: boolean;
  nfc_enabled: boolean;
  password_protected: boolean;
  card_password: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  // Aggregated
  total_views_30d?: string;
  total_saves_30d?: string;
  total_shares_30d?: string;
  custom_link_count?: string;
};

type CardLink = {
  id: string;
  card_id: string;
  label: string;
  url: string;
  icon: string;
  order_index: number;
  click_count: number;
  is_active: boolean;
};

type Analytics = {
  period_days: number;
  total_stats: {
    total_views: string;
    total_contact_clicks: string;
    total_social_clicks: string;
    total_saves: string;
    total_shares: string;
    total_qr_scans: string;
    viral_coefficient: string;
  };
  daily_views: Array<{ day: string; views: string; saves: string; shares: string; total_events: string }>;
  action_breakdown: Array<{ action: string; cnt: string }>;
  top_links: Array<{ element: string; clicks: string }>;
  device_breakdown: Array<{ device: string; cnt: string; pct: string }>;
  referrer_breakdown: Array<{ referrer: string; cnt: string }>;
  geo_breakdown: Array<{ country: string; cnt: string }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['cards', 'builder', 'analytics', 'qr_nfc', 'sharing'] as const;
type Tab = typeof TABS[number];

const THEMES = [
  { id: 'modern', label: 'Modern', bg: '#F3F4F6', accent: '#3B82F6' },
  { id: 'minimal', label: 'Minimal', bg: '#FAFAFA', accent: '#6B7280' },
  { id: 'bold', label: 'Bold', bg: '#0F172A', accent: '#F97316' },
  { id: 'gradient', label: 'Gradient', bg: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', accent: '#fff' },
  { id: 'corporate', label: 'Corporate', bg: '#F1F5F9', accent: '#1E3A5F' },
  { id: 'creative', label: 'Creative', bg: '#FFFBEB', accent: '#F59E0B' },
];

const LAYOUTS = ['standard', 'centered', 'sidebar', 'banner'];
const CARD_TYPES = ['personal', 'business', 'team_member', 'product', 'service', 'event'];
const LINK_ICONS = ['link', 'calendar', 'shop', 'pdf', 'video', 'phone', 'email'];
const PRESET_COLORS = ['#3B82F6', '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#1E3A5F', '#F59E0B', '#06B6D4'];

const emptyForm = (): Partial<DigitalCard> & { links: Partial<CardLink>[] } => ({
  card_type: 'personal', owner_name: '', job_title: '', company_name: '', tagline: '', bio: '',
  profile_photo_url: '', cover_photo_url: '', email: '', phone: '', whatsapp_number: '', website_url: '',
  city: '', country: '',
  linkedin_url: '', twitter_url: '', instagram_url: '', facebook_url: '', youtube_url: '',
  tiktok_url: '', github_url: '', pinterest_url: '', snapchat_url: '', threads_url: '',
  calendly_url: '', zoom_link: '', google_meet_url: '', shopify_url: '', etsy_url: '', amazon_store_url: '',
  theme: 'modern', primary_color: '#3B82F6', secondary_color: '#1E40AF',
  background_color: '#FFFFFF', text_color: '#1F2937', font_family: 'Inter', layout: 'standard',
  is_active: true, show_qr_on_card: true, allow_contact_form: true, nfc_enabled: false,
  password_protected: false, card_password: '', meta_title: '', meta_description: '',
  links: [],
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InitialsAvatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50, backgroundColor: color + '22', color }}>{text}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, color: '#111827' }}>{value}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9CA3AF' }}>{sub}</p>}
    </div>
  );
}

function Section({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [isOpen, setIsOpen] = useState(open);
  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <button onClick={() => setIsOpen(v => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#F9FAFB', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#374151' }}>
        {title}
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {isOpen && <div style={{ padding: 16 }}>{children}</div>}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, boxSizing: 'border-box', outline: 'none' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' };

// ─── Mini Card Preview ────────────────────────────────────────────────────────

function MiniCardPreview({ form }: { form: ReturnType<typeof emptyForm> }) {
  const theme = form.theme || 'modern';
  const primary = form.primary_color || '#3B82F6';
  const secondary = form.secondary_color || '#1E40AF';
  const bg = form.background_color || '#FFFFFF';
  const textC = form.text_color || '#1F2937';

  const wrapperStyle: React.CSSProperties = (() => {
    switch (theme) {
      case 'bold': return { backgroundColor: '#0F172A', color: '#F8FAFC' };
      case 'gradient': return { background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, color: '#fff' };
      case 'minimal': return { backgroundColor: '#FAFAFA', color: '#1F2937' };
      case 'corporate': return { backgroundColor: '#F1F5F9', color: '#1E293B' };
      case 'creative': return { backgroundColor: bg, color: textC };
      default: return { backgroundColor: '#F3F4F6', color: textC };
    }
  })();

  const cardStyle: React.CSSProperties = (() => {
    switch (theme) {
      case 'bold': return { backgroundColor: '#1E293B', border: `2px solid ${primary}`, borderRadius: 12 };
      case 'gradient': return { backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12 };
      case 'minimal': return { backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8 };
      case 'corporate': return { backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', borderRadius: 10 };
      case 'creative': return { backgroundColor: '#fff', border: `3px solid ${primary}`, borderRadius: 16 };
      default: return { backgroundColor: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', borderRadius: 12 };
    }
  })();

  const name = form.owner_name || 'Your Name';
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{ ...wrapperStyle, padding: 12, borderRadius: 16, minHeight: 200, fontFamily: form.font_family || 'Inter, sans-serif' }}>
      <div style={{ ...cardStyle, padding: '20px 16px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 auto 10px' }}>
          {form.profile_photo_url ? <img src={form.profile_photo_url} alt="Profile" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{name}</div>
        {form.job_title && <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 2 }}>{form.job_title}</div>}
        {form.company_name && <div style={{ fontSize: 11, opacity: 0.55 }}>{form.company_name}</div>}
        {form.tagline && <div style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.6, marginTop: 6 }}>&ldquo;{form.tagline}&rdquo;</div>}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {form.email && <span style={{ padding: '4px 10px', borderRadius: 50, backgroundColor: primary, color: '#fff', fontSize: 10, fontWeight: 600 }}>Email</span>}
          {form.phone && <span style={{ padding: '4px 10px', borderRadius: 50, backgroundColor: primary, color: '#fff', fontSize: 10, fontWeight: 600 }}>Call</span>}
          {form.whatsapp_number && <span style={{ padding: '4px 10px', borderRadius: 50, backgroundColor: '#25D366', color: '#fff', fontSize: 10, fontWeight: 600 }}>WhatsApp</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DigitalCardsPage() {
  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<DigitalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [qrSize, setQrSize] = useState(300);
  const [qrData, setQrData] = useState<{ qr_image_url: string; card_url: string; slug: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // ── Load cards ────────────────────────────────────────────────────────────

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/digital-cards');
      if (!res.ok) throw new Error('Failed to load cards');
      const data = await res.json();
      setCards(data.cards || []);
      if (!selectedCardId && data.cards?.length) setSelectedCardId(data.cards[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedCardId]);

  useEffect(() => { loadCards(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load analytics ────────────────────────────────────────────────────────

  const loadAnalytics = useCallback(async (cardId: string, days: number) => {
    if (!cardId) return;
    try {
      setAnalyticsLoading(true);
      const res = await fetch(`/api/admin/digital-cards/${cardId}/analytics?days=${days}`);
      if (!res.ok) return;
      const data = await res.json();
      setAnalytics(data);
    } catch { /* silent */ } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'analytics' && selectedCardId) loadAnalytics(selectedCardId, analyticsDays);
  }, [tab, selectedCardId, analyticsDays, loadAnalytics]);

  // ── Load QR ───────────────────────────────────────────────────────────────

  const loadQR = useCallback(async (cardId: string, size: number) => {
    if (!cardId) return;
    try {
      const res = await fetch(`/api/admin/digital-cards/${cardId}/qr?size=${size}`);
      if (!res.ok) return;
      const data = await res.json();
      setQrData(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (tab === 'qr_nfc' && selectedCardId) loadQR(selectedCardId, qrSize);
  }, [tab, selectedCardId, qrSize, loadQR]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  const setField = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const startEdit = (card: DigitalCard) => {
    setEditingId(card.id);
    setForm({ ...emptyForm(), ...card, links: [] });
    setFormMsg('');
    setTab('builder');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    // Load links
    fetch(`/api/admin/digital-cards/${card.id}/links`)
      .then(r => r.json())
      .then(d => setForm(f => ({ ...f, links: d.links || [] })));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormMsg('');
  };

  const handleSave = async () => {
    if (!form.owner_name?.trim()) { setFormMsg('Owner name is required.'); return; }
    setSaving(true);
    setFormMsg('');
    try {
      const { links, ...cardData } = form;
      let cardId = editingId;

      if (editingId) {
        const res = await fetch(`/api/admin/digital-cards/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cardData),
        });
        if (!res.ok) { const d = await res.json(); setFormMsg(d.error || 'Save failed.'); return; }
      } else {
        const res = await fetch('/api/admin/digital-cards', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cardData),
        });
        if (!res.ok) { const d = await res.json(); setFormMsg(d.error || 'Create failed.'); return; }
        const d = await res.json();
        cardId = d.card.id;
        setEditingId(cardId);
      }

      // Save custom links if editing
      if (cardId && links.length) {
        for (const link of links) {
          if (!link.id && link.label && link.url) {
            await fetch(`/api/admin/digital-cards/${cardId}/links`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label: link.label, url: link.url, icon: link.icon || 'link', order_index: link.order_index }),
            });
          }
        }
      }

      setFormMsg('Card saved successfully!');
      await loadCards();
    } catch {
      setFormMsg('Unexpected error saving card.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this card?')) return;
    await fetch(`/api/admin/digital-cards/${id}`, { method: 'DELETE' });
    await loadCards();
  };

  const duplicateCard = (card: DigitalCard) => {
    const { id, slug, created_at, updated_at, view_count, click_count, share_count, save_count, ...rest } = card;
    void id; void created_at; void updated_at; void view_count; void click_count; void share_count; void save_count;
    setEditingId(null);
    setForm({ ...emptyForm(), ...rest, slug: `${slug}-copy`, links: [] });
    setFormMsg('');
    setTab('builder');
  };

  const exportAnalyticsCSV = () => {
    if (!analytics) return;
    const rows = [
      ['Day', 'Views', 'Saves', 'Shares', 'Total Events'],
      ...analytics.daily_views.map(d => [d.day, d.views, d.saves, d.shares, d.total_events]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `card-analytics-${selectedCardId}.csv`;
    a.click();
  };

  // ── KPI summary ───────────────────────────────────────────────────────────

  const totalViews30d = cards.reduce((s, c) => s + parseInt(c.total_views_30d || '0'), 0);
  const totalSaves = cards.reduce((s, c) => s + parseInt(c.total_saves_30d || '0'), 0);
  const totalShares = cards.reduce((s, c) => s + parseInt(c.total_shares_30d || '0'), 0);
  const bestCard = [...cards].sort((a, b) => parseInt(b.total_views_30d || '0') - parseInt(a.total_views_30d || '0'))[0];
  const avgViewsPerDay = totalViews30d > 0 ? (totalViews30d / 30).toFixed(1) : '0';

  const selectedCard = cards.find(c => c.id === selectedCardId);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sohamyoga.com';

  // ── UTM links ─────────────────────────────────────────────────────────────

  const utmSources = [
    { label: 'Instagram', source: 'instagram', medium: 'social' },
    { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
    { label: 'Email', source: 'email', medium: 'email' },
    { label: 'QR Code', source: 'qr', medium: 'print' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '20px 32px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Digital Business Card Builder</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6B7280' }}>Create, manage, and share professional digital business cards with QR codes and NFC support</p>
      </div>

      {/* Tabs */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 32px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {([
          ['cards', 'My Cards'],
          ['builder', 'Card Builder'],
          ['analytics', 'Analytics'],
          ['qr_nfc', 'QR & NFC'],
          ['sharing', 'Affiliate & Sharing'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '14px 20px', border: 'none', borderBottom: tab === id ? '2px solid #3B82F6' : '2px solid transparent', backgroundColor: 'transparent', color: tab === id ? '#3B82F6' : '#6B7280', fontWeight: tab === id ? 700 : 500, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* ── TAB: My Cards ─────────────────────────────────────────────────── */}
        {tab === 'cards' && (
          <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Cards" value={cards.length} />
              <StatCard label="Total Views (30d)" value={totalViews30d.toLocaleString()} />
              <StatCard label="Total Saves" value={totalSaves.toLocaleString()} />
              <StatCard label="Total Shares" value={totalShares.toLocaleString()} />
              <StatCard label="Best Performing" value={bestCard?.owner_name || '—'} sub={`${bestCard?.total_views_30d || 0} views`} />
              <StatCard label="Avg Views/Day" value={avgViewsPerDay} />
            </div>

            {/* Create button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => { resetForm(); setTab('builder'); }}
                style={{ padding: '10px 20px', borderRadius: 8, backgroundColor: '#3B82F6', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                + Create New Card
              </button>
            </div>

            {loading && <p style={{ color: '#6B7280' }}>Loading cards...</p>}
            {error && <p style={{ color: '#EF4444' }}>{error}</p>}

            {/* Cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {cards.map(card => (
                <div key={card.id} style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Colored accent bar */}
                  <div style={{ height: 6, backgroundColor: card.primary_color }} />
                  <div style={{ padding: '16px 20px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <InitialsAvatar name={card.owner_name} color={card.primary_color} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.owner_name}</h3>
                          {!card.is_active && <Badge text="Inactive" color="#6B7280" />}
                        </div>
                        {card.job_title && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151' }}>{card.job_title}</p>}
                        {card.company_name && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280' }}>{card.company_name}</p>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <Badge text={card.theme} color={card.primary_color} />
                          <Badge text={card.card_type} color="#8B5CF6" />
                        </div>
                      </div>
                      {/* Mini QR */}
                      <img
                        src={`https://chart.googleapis.com/chart?chs=60x60&cht=qr&chl=${encodeURIComponent(`${baseUrl}/card/${card.slug}`)}&choe=UTF-8`}
                        alt="QR"
                        style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 6, border: '1px solid #E5E7EB' }}
                      />
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{card.total_views_30d || 0}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>Views</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{card.click_count || 0}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>Clicks</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{card.total_saves_30d || 0}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>Saves</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{card.total_shares_30d || 0}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>Shares</div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => startEdit(card)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <a href={`/card/${card.slug}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>View Live →</a>
                    <button onClick={() => { setSelectedCardId(card.id); setTab('analytics'); }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Analytics</button>
                    <button onClick={() => duplicateCard(card)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Duplicate</button>
                    {card.is_active && (
                      <button onClick={() => handleDeactivate(card.id)}
                        style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Deactivate</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: Card Builder ─────────────────────────────────────────────── */}
        {tab === 'builder' && (
          <div ref={formRef} style={{ display: 'grid', gridTemplateColumns: '1fr 375px', gap: 24, alignItems: 'start' }}>
            {/* Form */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                  {editingId ? 'Edit Card' : 'Create New Card'}
                </h2>
                {editingId && (
                  <button onClick={resetForm}
                    style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 13, cursor: 'pointer' }}>
                    New Card
                  </button>
                )}
              </div>

              {/* Identity */}
              <Section title="Identity" open>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Card Type">
                    <select value={form.card_type} onChange={e => setField('card_type', e.target.value)} style={inputStyle}>
                      {CARD_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="URL Slug (auto-generated)">
                    <input value={form.slug || ''} onChange={e => setField('slug', e.target.value)} style={inputStyle} placeholder="e.g. john-doe" />
                  </FieldRow>
                </div>
                <FieldRow label="Owner Name *">
                  <input value={form.owner_name || ''} onChange={e => setField('owner_name', e.target.value)} style={inputStyle} placeholder="Full name" />
                </FieldRow>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Job Title">
                    <input value={form.job_title || ''} onChange={e => setField('job_title', e.target.value)} style={inputStyle} placeholder="e.g. CEO" />
                  </FieldRow>
                  <FieldRow label="Company Name">
                    <input value={form.company_name || ''} onChange={e => setField('company_name', e.target.value)} style={inputStyle} placeholder="Company" />
                  </FieldRow>
                </div>
                <FieldRow label="Tagline">
                  <input value={form.tagline || ''} onChange={e => setField('tagline', e.target.value)} style={inputStyle} placeholder="Short tagline" />
                </FieldRow>
                <FieldRow label="Bio">
                  <textarea value={form.bio || ''} onChange={e => setField('bio', e.target.value)} style={textareaStyle} placeholder="About you..." />
                </FieldRow>
              </Section>

              {/* Photos */}
              <Section title="Photos" open={false}>
                <FieldRow label="Profile Photo URL">
                  <input value={form.profile_photo_url || ''} onChange={e => setField('profile_photo_url', e.target.value)} style={inputStyle} placeholder="https://..." />
                  {form.profile_photo_url && <img src={form.profile_photo_url} alt="Profile preview" style={{ marginTop: 8, width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E5E7EB' }} />}
                </FieldRow>
                <FieldRow label="Cover Photo URL">
                  <input value={form.cover_photo_url || ''} onChange={e => setField('cover_photo_url', e.target.value)} style={inputStyle} placeholder="https://..." />
                  {form.cover_photo_url && <img src={form.cover_photo_url} alt="Cover preview" style={{ marginTop: 8, width: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 8, border: '2px solid #E5E7EB' }} />}
                </FieldRow>
              </Section>

              {/* Contact */}
              <Section title="Contact" open>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Email"><input value={form.email || ''} onChange={e => setField('email', e.target.value)} style={inputStyle} placeholder="email@company.com" type="email" /></FieldRow>
                  <FieldRow label="Phone"><input value={form.phone || ''} onChange={e => setField('phone', e.target.value)} style={inputStyle} placeholder="+1 555 000 0000" /></FieldRow>
                  <FieldRow label="WhatsApp Number"><input value={form.whatsapp_number || ''} onChange={e => setField('whatsapp_number', e.target.value)} style={inputStyle} placeholder="+15550000000" /></FieldRow>
                  <FieldRow label="Website URL"><input value={form.website_url || ''} onChange={e => setField('website_url', e.target.value)} style={inputStyle} placeholder="https://..." /></FieldRow>
                  <FieldRow label="City"><input value={form.city || ''} onChange={e => setField('city', e.target.value)} style={inputStyle} placeholder="Toronto" /></FieldRow>
                  <FieldRow label="Country"><input value={form.country || ''} onChange={e => setField('country', e.target.value)} style={inputStyle} placeholder="Canada" /></FieldRow>
                </div>
              </Section>

              {/* Social Media */}
              <Section title="Social Media" open={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['linkedin_url', 'LinkedIn'], ['twitter_url', 'Twitter/X'],
                    ['instagram_url', 'Instagram'], ['facebook_url', 'Facebook'],
                    ['youtube_url', 'YouTube'], ['tiktok_url', 'TikTok'],
                    ['github_url', 'GitHub'], ['pinterest_url', 'Pinterest'],
                    ['snapchat_url', 'Snapchat'], ['threads_url', 'Threads'],
                  ].map(([key, label]) => (
                    <FieldRow key={key} label={label}>
                      <input value={(form as Record<string, unknown>)[key] as string || ''} onChange={e => setField(key, e.target.value)} style={inputStyle} placeholder="https://..." />
                    </FieldRow>
                  ))}
                </div>
              </Section>

              {/* Scheduling */}
              <Section title="Scheduling & Meeting" open={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Calendly URL"><input value={form.calendly_url || ''} onChange={e => setField('calendly_url', e.target.value)} style={inputStyle} placeholder="https://calendly.com/..." /></FieldRow>
                  <FieldRow label="Zoom Link"><input value={form.zoom_link || ''} onChange={e => setField('zoom_link', e.target.value)} style={inputStyle} placeholder="https://zoom.us/..." /></FieldRow>
                  <FieldRow label="Google Meet URL"><input value={form.google_meet_url || ''} onChange={e => setField('google_meet_url', e.target.value)} style={inputStyle} placeholder="https://meet.google.com/..." /></FieldRow>
                </div>
              </Section>

              {/* Online Store */}
              <Section title="Online Store" open={false}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Shopify URL"><input value={form.shopify_url || ''} onChange={e => setField('shopify_url', e.target.value)} style={inputStyle} placeholder="https://..." /></FieldRow>
                  <FieldRow label="Etsy URL"><input value={form.etsy_url || ''} onChange={e => setField('etsy_url', e.target.value)} style={inputStyle} placeholder="https://etsy.com/shop/..." /></FieldRow>
                  <FieldRow label="Amazon Store URL"><input value={form.amazon_store_url || ''} onChange={e => setField('amazon_store_url', e.target.value)} style={inputStyle} placeholder="https://amazon.com/..." /></FieldRow>
                </div>
              </Section>

              {/* Custom Links */}
              <Section title={`Custom Links (${form.links.length})`} open>
                {form.links.map((link, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                    <FieldRow label={idx === 0 ? 'Label' : ''}>
                      <input value={link.label || ''} onChange={e => setForm(f => { const links = [...f.links]; links[idx] = { ...links[idx], label: e.target.value }; return { ...f, links }; })} style={inputStyle} placeholder="My Portfolio" />
                    </FieldRow>
                    <FieldRow label={idx === 0 ? 'URL' : ''}>
                      <input value={link.url || ''} onChange={e => setForm(f => { const links = [...f.links]; links[idx] = { ...links[idx], url: e.target.value }; return { ...f, links }; })} style={inputStyle} placeholder="https://..." />
                    </FieldRow>
                    <FieldRow label={idx === 0 ? 'Icon' : ''}>
                      <select value={link.icon || 'link'} onChange={e => setForm(f => { const links = [...f.links]; links[idx] = { ...links[idx], icon: e.target.value }; return { ...f, links }; })} style={inputStyle}>
                        {LINK_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </FieldRow>
                    <button onClick={() => setForm(f => ({ ...f, links: f.links.filter((_, i) => i !== idx) }))}
                      style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                ))}
                {form.links.length < 10 && (
                  <button onClick={() => setForm(f => ({ ...f, links: [...f.links, { label: '', url: '', icon: 'link', order_index: f.links.length }] }))}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed #D1D5DB', backgroundColor: '#F9FAFB', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                    + Add Custom Link
                  </button>
                )}
              </Section>

              {/* Design */}
              <Section title="Design" open>
                {/* Theme swatches */}
                <FieldRow label="Theme">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {THEMES.map(t => (
                      <button key={t.id} onClick={() => setField('theme', t.id)}
                        style={{ padding: '10px 8px', borderRadius: 8, border: form.theme === t.id ? `2px solid ${t.accent !== '#fff' ? t.accent : '#3B82F6'}` : '2px solid #E5E7EB', background: t.bg, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: t.accent === '#fff' ? '#fff' : '#374151' }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </FieldRow>

                {/* Colors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['primary_color', 'Primary Color'],
                    ['secondary_color', 'Secondary Color'],
                    ['background_color', 'Background Color'],
                    ['text_color', 'Text Color'],
                  ].map(([key, label]) => (
                    <FieldRow key={key} label={label}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="color" value={(form as Record<string, unknown>)[key] as string || '#3B82F6'} onChange={e => setField(key, e.target.value)} style={{ width: 36, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {PRESET_COLORS.map(c => (
                            <div key={c} onClick={() => setField(key, c)} style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: (form as Record<string, unknown>)[key] === c ? '2px solid #111' : '2px solid transparent' }} />
                          ))}
                        </div>
                      </div>
                    </FieldRow>
                  ))}
                </div>

                {/* Font */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldRow label="Font Family">
                    <select value={form.font_family || 'Inter'} onChange={e => setField('font_family', e.target.value)} style={inputStyle}>
                      {['Inter', 'Georgia', 'Arial', 'Helvetica', 'Roboto', 'Merriweather', 'Playfair Display', 'Montserrat'].map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Layout">
                    <select value={form.layout || 'standard'} onChange={e => setField('layout', e.target.value)} style={inputStyle}>
                      {LAYOUTS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </FieldRow>
                </div>
              </Section>

              {/* Settings */}
              <Section title="Settings" open={false}>
                {[
                  ['is_active', 'Card Active'],
                  ['show_qr_on_card', 'Show QR Code on Card'],
                  ['allow_contact_form', 'Allow Contact Form'],
                  ['nfc_enabled', 'NFC Enabled'],
                  ['password_protected', 'Password Protected'],
                ].map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label style={{ fontSize: 14, color: '#374151' }}>{label}</label>
                    <div onClick={() => setField(key, !(form as Record<string, unknown>)[key])}
                      style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: (form as Record<string, unknown>)[key] ? '#3B82F6' : '#D1D5DB', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff', position: 'absolute', top: 3, left: (form as Record<string, unknown>)[key] ? 23 : 3, transition: 'left 0.2s' }} />
                    </div>
                  </div>
                ))}
                {form.password_protected && (
                  <FieldRow label="Card Password">
                    <input type="password" value={form.card_password || ''} onChange={e => setField('card_password', e.target.value)} style={inputStyle} placeholder="Set a password" />
                  </FieldRow>
                )}
                <FieldRow label="Meta Title">
                  <input value={form.meta_title || ''} onChange={e => setField('meta_title', e.target.value)} style={inputStyle} placeholder="SEO title" />
                </FieldRow>
                <FieldRow label="Meta Description">
                  <textarea value={form.meta_description || ''} onChange={e => setField('meta_description', e.target.value)} style={textareaStyle} placeholder="SEO description" />
                </FieldRow>
              </Section>

              {/* Save button */}
              <div style={{ marginTop: 16 }}>
                {formMsg && (
                  <p style={{ padding: '10px 16px', borderRadius: 8, backgroundColor: formMsg.includes('success') ? '#F0FDF4' : '#FEF2F2', color: formMsg.includes('success') ? '#166534' : '#DC2626', fontSize: 14, marginBottom: 12 }}>
                    {formMsg}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSave} disabled={saving}
                    style={{ flex: 1, padding: '12px 24px', borderRadius: 10, backgroundColor: '#3B82F6', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Card'}
                  </button>
                  {editingId && (
                    <a href={`/card/${form.slug}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #D1D5DB', backgroundColor: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      Full Preview →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Live preview panel */}
            <div style={{ position: 'sticky', top: 24 }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Live Preview (375px)</h3>
                <div style={{ width: 375, maxWidth: '100%', margin: '0 auto', overflow: 'hidden', borderRadius: 16, border: '1px solid #E5E7EB' }}>
                  <MiniCardPreview form={form} />
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>Updates in real-time as you type</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Analytics ────────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: 220 }}>
                {cards.map(c => <option key={c.id} value={c.id}>{c.owner_name} — {c.slug}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setAnalyticsDays(d)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: analyticsDays === d ? '#3B82F6' : '#fff', color: analyticsDays === d ? '#fff' : '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    {d}d
                  </button>
                ))}
              </div>
              <button onClick={exportAnalyticsCSV} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}>
                Export CSV
              </button>
            </div>

            {analyticsLoading && <p style={{ color: '#6B7280' }}>Loading analytics...</p>}

            {analytics && (
              <div>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <StatCard label="Total Views" value={analytics.total_stats.total_views} />
                  <StatCard label="Contact Clicks" value={analytics.total_stats.total_contact_clicks} />
                  <StatCard label="Social Clicks" value={analytics.total_stats.total_social_clicks} />
                  <StatCard label="Saves" value={analytics.total_stats.total_saves} />
                  <StatCard label="Shares" value={analytics.total_stats.total_shares} />
                  <StatCard label="QR Scans" value={analytics.total_stats.total_qr_scans} />
                  <StatCard label="Viral Coefficient" value={analytics.total_stats.viral_coefficient || '0'} sub="shares per view" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                  {/* Daily trend */}
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>Views Trend (last {analytics.period_days}d)</h3>
                    {analytics.daily_views.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 14 }}>No data in period.</p>}
                    {analytics.daily_views.map(d => {
                      const maxViews = Math.max(...analytics.daily_views.map(r => parseInt(r.views)));
                      const pct = maxViews ? (parseInt(d.views) / maxViews) * 100 : 0;
                      return (
                        <div key={d.day} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: '#6B7280', width: 80, flexShrink: 0 }}>{d.day?.slice(5)}</span>
                          <div style={{ flex: 1, height: 14, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, width: 30, textAlign: 'right' }}>{d.views}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action breakdown + device */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Action Breakdown</h3>
                      {analytics.action_breakdown.map(a => (
                        <div key={a.action} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ color: '#374151', textTransform: 'capitalize' }}>{a.action.replace('_', ' ')}</span>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{a.cnt}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Device Split</h3>
                      {analytics.device_breakdown.map(d => (
                        <div key={d.device} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                          <span style={{ color: '#374151', textTransform: 'capitalize' }}>{d.device}</span>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{d.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top links + referrers + geo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Top Clicked Elements</h3>
                    {analytics.top_links.length === 0 && <p style={{ color: '#9CA3AF', fontSize: 13 }}>No clicks yet.</p>}
                    {analytics.top_links.map((l, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{l.element}</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{l.clicks}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Referrers (Best Channel)</h3>
                    {analytics.referrer_breakdown.map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: '#374151' }}>{r.referrer}</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{r.cnt}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Geographic Breakdown</h3>
                    {analytics.geo_breakdown.map((g, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: '#374151' }}>{g.country}</span>
                        <span style={{ fontWeight: 700, color: '#111827' }}>{g.cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: QR & NFC ─────────────────────────────────────────────────── */}
        {tab === 'qr_nfc' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* QR section */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#111827' }}>QR Code Generator</h2>

              <FieldRow label="Select Card">
                <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={inputStyle}>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.owner_name} — {c.slug}</option>)}
                </select>
              </FieldRow>

              <FieldRow label="QR Size">
                <div style={{ display: 'flex', gap: 8 }}>
                  {[200, 300, 400, 500].map(s => (
                    <button key={s} onClick={() => setQrSize(s)}
                      style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: qrSize === s ? '#3B82F6' : '#fff', color: qrSize === s ? '#fff' : '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      {s}px
                    </button>
                  ))}
                </div>
              </FieldRow>

              {selectedCard && (
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <div style={{ display: 'inline-block', padding: 16, backgroundColor: '#fff', borderRadius: 12, border: '2px solid #E5E7EB' }}>
                    <img
                      src={`https://chart.googleapis.com/chart?chs=${qrSize}x${qrSize}&cht=qr&chl=${encodeURIComponent(`${baseUrl}/card/${selectedCard.slug}`)}&choe=UTF-8`}
                      alt="QR Code"
                      style={{ width: Math.min(qrSize, 280), height: Math.min(qrSize, 280), display: 'block' }}
                    />
                  </div>
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>{baseUrl}/card/{selectedCard.slug}</p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                    <a
                      href={`https://chart.googleapis.com/chart?chs=${qrSize}x${qrSize}&cht=qr&chl=${encodeURIComponent(`${baseUrl}/card/${selectedCard.slug}`)}&choe=UTF-8`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: '#3B82F6', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                      Download PNG
                    </a>
                  </div>
                </div>
              )}

              {/* Print-ready card */}
              {selectedCard && (
                <div style={{ marginTop: 20, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#374151' }}>Print-Ready Business Card (3.5&quot; × 2&quot;)</h4>
                  <button onClick={() => {
                    const win = window.open('', '_blank');
                    if (!win) return;
                    const qrSrc = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(`${baseUrl}/card/${selectedCard.slug}`)}&choe=UTF-8`;
                    win.document.write(`<!DOCTYPE html><html><head><style>
                      @page { size: 3.5in 2in; margin: 0; }
                      body { margin: 0; width: 3.5in; height: 2in; display: flex; align-items: center; font-family: Arial, sans-serif; background: #fff; }
                      .card { display: flex; padding: 12px; gap: 12px; align-items: center; width: 100%; box-sizing: border-box; }
                      .info { flex: 1; }
                      .name { font-size: 13pt; font-weight: bold; color: ${selectedCard.primary_color}; }
                      .title { font-size: 9pt; color: #555; margin-top: 2px; }
                      .company { font-size: 9pt; color: #777; margin-top: 2px; }
                      .contact { font-size: 7.5pt; color: #444; margin-top: 8px; line-height: 1.5; }
                      .qr { width: 80px; height: 80px; flex-shrink: 0; }
                      .accent { height: 4px; background: ${selectedCard.primary_color}; width: 100%; position: absolute; top: 0; left: 0; }
                    </style></head><body>
                    <div class="card" style="position:relative;">
                      <div class="accent"></div>
                      <div class="info">
                        <div class="name">${selectedCard.owner_name}</div>
                        ${selectedCard.job_title ? `<div class="title">${selectedCard.job_title}</div>` : ''}
                        ${selectedCard.company_name ? `<div class="company">${selectedCard.company_name}</div>` : ''}
                        <div class="contact">
                          ${selectedCard.email ? `<div>✉ ${selectedCard.email}</div>` : ''}
                          ${selectedCard.phone ? `<div>☎ ${selectedCard.phone}</div>` : ''}
                          ${selectedCard.website_url ? `<div>🌐 ${selectedCard.website_url}</div>` : ''}
                        </div>
                      </div>
                      <img class="qr" src="${qrSrc}" alt="QR" />
                    </div></body></html>`);
                    win.document.close();
                    win.print();
                  }}
                    style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: '#fff', border: '1px solid #D1D5DB', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                    Print Card
                  </button>
                </div>
              )}
            </div>

            {/* NFC guide */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
              <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#111827' }}>NFC Setup Guide</h2>

              {selectedCard && (
                <div style={{ padding: 12, backgroundColor: selectedCard.nfc_enabled ? '#F0FDF4' : '#FFF7ED', borderRadius: 8, border: `1px solid ${selectedCard.nfc_enabled ? '#BBF7D0' : '#FED7AA'}`, marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: selectedCard.nfc_enabled ? '#166534' : '#92400E' }}>
                    NFC is {selectedCard.nfc_enabled ? 'ENABLED' : 'DISABLED'} for {selectedCard.owner_name}&apos;s card
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { step: '1', title: 'Purchase NFC Cards', desc: 'Buy NFC stickers or cards for ~$2–5 each on AliExpress, Amazon, or similar. Look for NTAG213 or NTAG215 chips (widely compatible).' },
                  { step: '2', title: 'Download NFC Writer App', desc: 'Install "NFC Tools" (iOS/Android) or "NFC TagWriter by NXP" — both are free and easy to use.' },
                  { step: '3', title: 'Write Your Card URL', desc: `Open the app → Write → Add record → URL → Enter your card URL: ${selectedCard ? `${baseUrl}/card/${selectedCard.slug}` : '{your-card-url}'}` },
                  { step: '4', title: 'Test the NFC Tag', desc: 'Hold your phone\'s NFC reader (usually on the back) to the tag — your digital card should open automatically.' },
                  { step: '5', title: 'Enable NFC in Settings', desc: 'Go back to Edit Card → Settings → toggle "NFC Enabled" to mark your card as NFC-capable.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {step}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111827' }}>{title}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#1D4ED8', fontWeight: 600 }}>Pro Tip</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#3730A3' }}>
                  Put NFC stickers inside physical business cards, on your laptop, on networking badges, or on a desk stand. When someone taps their phone, your digital card instantly opens — no app needed on their end.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Affiliate & Sharing ──────────────────────────────────────── */}
        {tab === 'sharing' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginRight: 12 }}>Select Card:</label>
              <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 220 }}>
                {cards.map(c => <option key={c.id} value={c.id}>{c.owner_name} — {c.slug}</option>)}
              </select>
            </div>

            {selectedCard && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                  {/* UTM links */}
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
                    <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>UTM-Tagged Share Links</h2>
                    {utmSources.map(utm => {
                      const url = `${baseUrl}/card/${selectedCard.slug}?utm_source=${utm.source}&utm_medium=${utm.medium}`;
                      return (
                        <div key={utm.source} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{utm.label}</span>
                            <button onClick={() => { navigator.clipboard.writeText(url); }}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                              Copy
                            </button>
                          </div>
                          <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: 11, color: '#6B7280', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {url}
                          </div>
                          {/* Mini QR for each UTM link */}
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img
                              src={`https://chart.googleapis.com/chart?chs=60x60&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8`}
                              alt={`${utm.label} QR`}
                              style={{ width: 60, height: 60, borderRadius: 6, border: '1px solid #E5E7EB' }}
                            />
                            <span style={{ fontSize: 11, color: '#9CA3AF' }}>QR for {utm.label}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Affiliate share link */}
                  <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
                    <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Affiliate Share Link</h2>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 16 }}>
                      If this card owner is an affiliate partner, embed their referral code to track which visitors they drove.
                    </p>

                    <FieldRow label="Affiliate Code (optional)">
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input id="affCodeInput" style={inputStyle} placeholder="e.g. REF123 or their partner code" />
                        <button onClick={() => {
                          const code = (document.getElementById('affCodeInput') as HTMLInputElement)?.value?.trim();
                          if (!code) return;
                          const url = `${baseUrl}/card/${selectedCard.slug}?ref=${encodeURIComponent(code)}`;
                          navigator.clipboard.writeText(url);
                        }}
                          style={{ padding: '9px 14px', borderRadius: 8, border: 'none', backgroundColor: '#3B82F6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Copy Link
                        </button>
                      </div>
                    </FieldRow>

                    <div style={{ marginTop: 20, padding: 16, backgroundColor: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#166534' }}>Share Performance</p>
                      <p style={{ margin: '8px 0 0', fontSize: 12, color: '#15803D' }}>
                        Track how each UTM source is performing in the Analytics tab. Filter by referrer to see which sharing channel (Instagram, LinkedIn, email, QR) brings the most saves and conversions.
                      </p>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151' }}>Share Performance Table</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F9FAFB' }}>
                            {['UTM Source', 'Visits', 'Saves', 'Clicks', 'Conv. Rate'].map(h => (
                              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {utmSources.map(utm => (
                            <tr key={utm.source}>
                              <td style={{ padding: '8px 10px', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>{utm.label}</td>
                              <td style={{ padding: '8px 10px', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>—</td>
                              <td style={{ padding: '8px 10px', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>—</td>
                              <td style={{ padding: '8px 10px', color: '#374151', borderBottom: '1px solid #F3F4F6' }}>—</td>
                              <td style={{ padding: '8px 10px', color: '#9CA3AF', borderBottom: '1px solid #F3F4F6' }}>Needs tracking</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9CA3AF' }}>Live UTM conversion data becomes available once viewers use tagged links. Check back in Analytics → Referrers.</p>
                    </div>
                  </div>
                </div>

                {/* Social share preview */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
                  <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Quick Share</h2>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                      { label: 'LinkedIn', color: '#0A66C2', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl}/card/${selectedCard.slug}?utm_source=linkedin&utm_medium=social`)}` },
                      { label: 'Twitter/X', color: '#000', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(`${baseUrl}/card/${selectedCard.slug}?utm_source=twitter&utm_medium=social`)}&text=${encodeURIComponent(`Connect with ${selectedCard.owner_name}`)}` },
                      { label: 'WhatsApp', color: '#25D366', url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`Connect with ${selectedCard.owner_name}: ${baseUrl}/card/${selectedCard.slug}?utm_source=whatsapp&utm_medium=social`)}` },
                      { label: 'Email', color: '#4B5563', url: `mailto:?subject=${encodeURIComponent(`Connect with ${selectedCard.owner_name}`)}&body=${encodeURIComponent(`Hi,\n\nHere is my digital business card: ${baseUrl}/card/${selectedCard.slug}?utm_source=email&utm_medium=email`)}` },
                    ].map(s => (
                      <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '10px 20px', borderRadius: 8, backgroundColor: s.color, color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
                        Share on {s.label}
                      </a>
                    ))}
                    <button onClick={() => navigator.clipboard.writeText(`${baseUrl}/card/${selectedCard.slug}`)}
                      style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', backgroundColor: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      Copy Card URL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
