'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

type CardLink = {
  id: string;
  label: string;
  url: string;
  icon: string;
  order_index: number;
  click_count: number;
};

type Card = {
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
  show_qr_on_card: boolean;
  allow_contact_form: boolean;
  nfc_enabled: boolean;
  password_protected: boolean;
  meta_title: string | null;
  meta_description: string | null;
};

// ─── Icon components (inline SVG) ────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}
function SaveIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

// ─── Custom link icon ────────────────────────────────────────────────────────

function CustomLinkIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'calendar': return <CalendarIcon />;
    case 'phone': return <PhoneIcon />;
    case 'email': return <EmailIcon />;
    case 'pdf': return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
    case 'video': return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
    case 'shop': return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    );
    default: return <LinkIcon />;
  }
}

// ─── Social platform map ─────────────────────────────────────────────────────

type SocialPlatform = { label: string; color: string; textColor: string };
const SOCIAL_PLATFORMS: Record<string, SocialPlatform> = {
  linkedin_url: { label: 'LinkedIn', color: '#0A66C2', textColor: '#fff' },
  twitter_url: { label: 'Twitter/X', color: '#000000', textColor: '#fff' },
  instagram_url: { label: 'Instagram', color: '#E1306C', textColor: '#fff' },
  facebook_url: { label: 'Facebook', color: '#1877F2', textColor: '#fff' },
  youtube_url: { label: 'YouTube', color: '#FF0000', textColor: '#fff' },
  tiktok_url: { label: 'TikTok', color: '#010101', textColor: '#fff' },
  github_url: { label: 'GitHub', color: '#24292E', textColor: '#fff' },
  pinterest_url: { label: 'Pinterest', color: '#BD081C', textColor: '#fff' },
  snapchat_url: { label: 'Snapchat', color: '#FFFC00', textColor: '#000' },
  threads_url: { label: 'Threads', color: '#101010', textColor: '#fff' },
};

// ─── Theme styles ─────────────────────────────────────────────────────────────

function getThemeStyles(card: Card) {
  switch (card.theme) {
    case 'bold':
      return {
        wrapper: { backgroundColor: card.background_color || '#0F172A', color: card.text_color || '#F8FAFC' },
        card: { backgroundColor: '#1E293B', border: `2px solid ${card.primary_color}` },
        accent: card.primary_color,
        pillBg: card.primary_color,
        pillText: '#fff',
        sectionTitle: { color: card.primary_color, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
        bio: { color: '#CBD5E1' },
        footer: { backgroundColor: '#0F172A', color: '#64748B' },
      };
    case 'gradient':
      return {
        wrapper: { background: `linear-gradient(135deg, ${card.primary_color} 0%, ${card.secondary_color} 100%)`, color: '#fff' },
        card: { backgroundColor: 'rgba(255,255,255,0.12)', backdropFilter: 'none', border: '1px solid rgba(255,255,255,0.2)' },
        accent: '#fff',
        pillBg: 'rgba(255,255,255,0.2)',
        pillText: '#fff',
        sectionTitle: { color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
        bio: { color: 'rgba(255,255,255,0.85)' },
        footer: { backgroundColor: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.6)' },
      };
    case 'minimal':
      return {
        wrapper: { backgroundColor: '#FAFAFA', color: '#1F2937' },
        card: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB' },
        accent: card.primary_color,
        pillBg: '#F3F4F6',
        pillText: '#374151',
        sectionTitle: { color: '#9CA3AF', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
        bio: { color: '#6B7280' },
        footer: { backgroundColor: '#F9FAFB', color: '#9CA3AF' },
      };
    case 'corporate':
      return {
        wrapper: { backgroundColor: '#F1F5F9', color: card.text_color || '#1E293B' },
        card: { backgroundColor: '#FFFFFF', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
        accent: card.primary_color,
        pillBg: card.primary_color,
        pillText: '#fff',
        sectionTitle: { color: '#475569', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
        bio: { color: '#64748B' },
        footer: { backgroundColor: '#F8FAFC', color: '#94A3B8' },
      };
    case 'creative':
      return {
        wrapper: { backgroundColor: card.background_color || '#FFFBEB', color: card.text_color || '#1F2937' },
        card: { backgroundColor: '#FFFFFF', border: `3px solid ${card.primary_color}`, borderRadius: '24px' },
        accent: card.primary_color,
        pillBg: card.primary_color,
        pillText: '#fff',
        sectionTitle: { color: card.secondary_color, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
        bio: { color: '#6B7280' },
        footer: { backgroundColor: card.background_color || '#FFFBEB', color: '#9CA3AF' },
      };
    default: // modern
      return {
        wrapper: { backgroundColor: '#F3F4F6', color: card.text_color || '#1F2937' },
        card: { backgroundColor: '#FFFFFF', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' },
        accent: card.primary_color,
        pillBg: card.primary_color,
        pillText: '#fff',
        sectionTitle: { color: '#6B7280', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
        bio: { color: '#6B7280' },
        footer: { backgroundColor: '#F9FAFB', color: '#9CA3AF' },
      };
  }
}

// ─── Initials avatar ──────────────────────────────────────────────────────────

function InitialsAvatar({ name, color, size = 96 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700
    }}>
      {initials}
    </div>
  );
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ slug, onSuccess }: { slug: string; onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/card/${slug}`, {
      headers: { 'X-Card-Password': password }
    });
    if (res.ok) {
      document.cookie = `card_auth_checked=1; path=/card/${slug}; max-age=86400`;
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 40, maxWidth: 380, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Protected Card</h2>
          <p style={{ color: '#6B7280', marginTop: 8 }}>This card requires a password to view.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 16, boxSizing: 'border-box', marginBottom: 12 }}
          />
          {error && <p style={{ color: '#EF4444', fontSize: 14, marginBottom: 12 }}>{error}</p>}
          <button
            type="submit"
            style={{ width: '100%', padding: '12px 16px', borderRadius: 8, backgroundColor: '#3B82F6', color: '#fff', fontWeight: 600, fontSize: 16, border: 'none', cursor: 'pointer' }}
          >
            View Card
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main card component ──────────────────────────────────────────────────────

export default function PublicCardPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [card, setCard] = useState<Card | null>(null);
  const [links, setLinks] = useState<CardLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [error, setError] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  const loadCard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/card/${slug}`);
      const data = await res.json();
      if (data.requires_password) {
        setRequiresPassword(true);
        return;
      }
      if (!res.ok) { setError(data.error || 'Card not found.'); return; }
      setCard(data.card);
      setLinks(data.links || []);
    } catch {
      setError('Failed to load card.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadCard(); }, [loadCard]);

  const track = useCallback(async (action: string, elementClicked?: string) => {
    try {
      await fetch(`/api/card/${slug}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, element_clicked: elementClicked }),
      });
    } catch { /* silent */ }
  }, [slug]);

  const handleSaveContact = useCallback(() => {
    if (!card) return;
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${card.owner_name}`,
      card.job_title ? `TITLE:${card.job_title}` : '',
      card.company_name ? `ORG:${card.company_name}` : '',
      card.phone ? `TEL:${card.phone}` : '',
      card.email ? `EMAIL:${card.email}` : '',
      card.website_url ? `URL:${card.website_url}` : '',
      'END:VCARD',
    ].filter(Boolean).join('\n');

    const a = document.createElement('a');
    a.href = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcf)}`;
    a.download = `${card.owner_name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    track('save_contact');
  }, [card, track]);

  const handleShare = useCallback(async () => {
    if (!card) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: card.owner_name, url });
        track('share');
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      track('share');
    }
  }, [card, track]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #E5E7EB', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          <p style={{ color: '#6B7280', marginTop: 16 }}>Loading card...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (requiresPassword) {
    return <PasswordGate slug={slug} onSuccess={() => { setRequiresPassword(false); loadCard(); }} />;
  }

  if (error || !card) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>404</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Card Not Found</h2>
          <p style={{ color: '#6B7280', marginTop: 8 }}>{error || 'This digital card does not exist or has been deactivated.'}</p>
        </div>
      </div>
    );
  }

  const theme = getThemeStyles(card);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const cardUrl = `${baseUrl}/card/${card.slug}`;
  const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(cardUrl)}&choe=UTF-8`;

  const socials = Object.entries(SOCIAL_PLATFORMS).filter(([key]) => card[key as keyof Card]);

  return (
    <div style={{ minHeight: '100vh', fontFamily: card.font_family || 'Inter, sans-serif', ...theme.wrapper }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 32 }}>

        {/* Cover Photo Banner */}
        {card.cover_photo_url && (
          <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
            <img src={card.cover_photo_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Card body */}
        <div style={{ margin: card.cover_photo_url ? '-40px 16px 0' : '24px 16px 0', borderRadius: 20, overflow: 'hidden', ...theme.card }}>

          {/* Profile header */}
          <div style={{ padding: '32px 24px 24px', textAlign: 'center', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {card.profile_photo_url ? (
                <img src={card.profile_photo_url} alt={card.owner_name}
                  style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${theme.accent}` }} />
              ) : (
                <InitialsAvatar name={card.owner_name} color={theme.accent} size={96} />
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{card.owner_name}</h1>
            {card.job_title && <p style={{ fontSize: 15, fontWeight: 500, margin: '6px 0 0', opacity: 0.8 }}>{card.job_title}</p>}
            {card.company_name && <p style={{ fontSize: 14, margin: '4px 0 0', opacity: 0.6 }}>{card.company_name}</p>}
            {(card.city || card.country) && (
              <p style={{ fontSize: 13, margin: '6px 0 0', opacity: 0.5 }}>
                {[card.city, card.country].filter(Boolean).join(', ')}
              </p>
            )}
            {card.tagline && (
              <p style={{ fontSize: 14, fontStyle: 'italic', margin: '12px 0 0', opacity: 0.7 }}>&ldquo;{card.tagline}&rdquo;</p>
            )}
          </div>

          {/* Bio */}
          {card.bio && (
            <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, ...theme.bio }}>{card.bio}</p>
            </div>
          )}

          {/* Contact buttons */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Contact</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {card.email && (
                <a href={`mailto:${card.email}`} onClick={() => track('contact_click', 'email')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 50, backgroundColor: theme.pillBg, color: theme.pillText, textDecoration: 'none', fontSize: 14, fontWeight: 500, flex: '1 1 auto' }}>
                  <EmailIcon /> Email
                </a>
              )}
              {card.phone && (
                <a href={`tel:${card.phone}`} onClick={() => track('contact_click', 'phone')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 50, backgroundColor: theme.pillBg, color: theme.pillText, textDecoration: 'none', fontSize: 14, fontWeight: 500, flex: '1 1 auto' }}>
                  <PhoneIcon /> Call
                </a>
              )}
              {card.whatsapp_number && (
                <a href={`https://wa.me/${card.whatsapp_number.replace(/\D/g, '')}`} onClick={() => track('contact_click', 'whatsapp')}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 50, backgroundColor: '#25D366', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 500, flex: '1 1 auto' }}>
                  <WhatsAppIcon /> WhatsApp
                </a>
              )}
              {card.website_url && (
                <a href={card.website_url} onClick={() => track('contact_click', 'website')}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 50, backgroundColor: theme.pillBg, color: theme.pillText, textDecoration: 'none', fontSize: 14, fontWeight: 500, flex: '1 1 auto' }}>
                  <GlobeIcon /> Website
                </a>
              )}
            </div>
          </div>

          {/* Social links */}
          {socials.length > 0 && (
            <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Social Media</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {socials.map(([key, platform]) => (
                  <a
                    key={key}
                    href={card[key as keyof Card] as string}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => track('social_click', platform.label)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                      borderRadius: 10, backgroundColor: platform.color, color: platform.textColor,
                      textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    }}>
                    {platform.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Custom links */}
          {links.length > 0 && (
            <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Links</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {links.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => track('social_click', link.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                      borderRadius: 12, border: `1px solid rgba(0,0,0,0.08)`,
                      textDecoration: 'none', color: 'inherit', fontWeight: 500, fontSize: 15,
                    }}>
                    <span style={{ color: theme.accent }}><CustomLinkIcon icon={link.icon} /></span>
                    {link.label}
                    <span style={{ marginLeft: 'auto', opacity: 0.3 }}>→</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Scheduling */}
          {(card.calendly_url || card.zoom_link || card.google_meet_url) && (
            <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Schedule a Meeting</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {card.calendly_url && (
                  <a href={card.calendly_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('contact_click', 'calendly')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#00A2FF', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    <CalendarIcon /> Book via Calendly
                  </a>
                )}
                {card.zoom_link && (
                  <a href={card.zoom_link} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('contact_click', 'zoom')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#2D8CFF', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    <CalendarIcon /> Join Zoom Meeting
                  </a>
                )}
                {card.google_meet_url && (
                  <a href={card.google_meet_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('contact_click', 'meet')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#34A853', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    <CalendarIcon /> Google Meet
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Store links */}
          {(card.shopify_url || card.etsy_url || card.amazon_store_url) && (
            <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Shop</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {card.shopify_url && (
                  <a href={card.shopify_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('social_click', 'shopify')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#96BF48', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    Shop on Shopify
                  </a>
                )}
                {card.etsy_url && (
                  <a href={card.etsy_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('social_click', 'etsy')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#F45800', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    Shop on Etsy
                  </a>
                )}
                {card.amazon_store_url && (
                  <a href={card.amazon_store_url} target="_blank" rel="noopener noreferrer"
                    onClick={() => track('social_click', 'amazon')}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 12, backgroundColor: '#FF9900', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                    Shop on Amazon
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action buttons: Save + Share */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveContact}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', borderRadius: 12, backgroundColor: theme.accent, color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                <SaveIcon /> Save Contact
              </button>
              <button onClick={handleShare}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px', borderRadius: 12, backgroundColor: 'transparent', color: theme.accent, border: `2px solid ${theme.accent}`, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                <ShareIcon /> {shareCopied ? 'Copied!' : 'Share'}
              </button>
            </div>
          </div>

          {/* QR Code */}
          {card.show_qr_on_card && (
            <div style={{ padding: '20px 24px', textAlign: 'center', borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
              <p style={{ ...theme.sectionTitle, marginBottom: 12, marginTop: 0 }}>Scan QR Code</p>
              <img src={qrUrl} alt="QR Code" style={{ width: 160, height: 160, margin: '0 auto', display: 'block', borderRadius: 8 }} />
              <p style={{ fontSize: 12, marginTop: 8, opacity: 0.5 }}>{cardUrl}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '20px 16px', ...theme.footer }}>
          <p style={{ margin: 0, fontSize: 12 }}>
            Digital Business Card powered by{' '}
            <a href="/" style={{ color: theme.accent, textDecoration: 'none', fontWeight: 600 }}>SohamYoga Platform</a>
          </p>
          {card.nfc_enabled && (
            <p style={{ margin: '4px 0 0', fontSize: 11 }}>NFC enabled — tap your phone to connect</p>
          )}
        </div>
      </div>
    </div>
  );
}
