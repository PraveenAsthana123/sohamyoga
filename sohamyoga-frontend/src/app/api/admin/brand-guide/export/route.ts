import { NextRequest } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Brand Guide PDF -- combines brand_kit (visual identity: colors,
// fonts, tone, approved/banned phrases) with social_brand_profile (voice:
// bios at 3 lengths, keywords, hashtags) and social_platform_bio
// (per-platform variants) into one real, professional document. No prior
// export existed for either table (found live 2026-09-01). Every field
// prints exactly what's stored -- an empty/never-configured field prints
// "(not set)", never a placeholder brand identity.
interface BrandKitRow {
  name: string; primary_color: string; secondary_color: string; accent_color: string;
  font_primary: string; font_secondary: string | null; tone_words: string[];
  approved_phrases: string[]; banned_phrases: string[]; default_hashtags: string[]; is_default: boolean;
}
interface ProfileRow {
  brand_name: string; legal_name: string | null; website_url: string | null; tagline: string | null;
  bio_80: string | null; bio_150: string | null; bio_255: string | null;
  keywords: string[]; default_hashtags: string[]; approval_status: string;
}
interface PlatformBioRow { platform: string; bio_text: string; bio_tier: string; status: string }

// Defensive against a real data-quality quirk found live: some
// default_hashtags rows store one space-separated string that already
// includes '#' (e.g. from an earlier draft job), rather than one bare
// word per array element -- avoid ever double-prefixing '##'.
function formatHashtags(tags: string[]): string {
  return tags.map(t => t.trim()).filter(Boolean).map(t => (t.startsWith('#') ? t : `#${t}`)).join(' ');
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0.5, 0.5, 0.5];
  return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
}

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const [kitRes, profileRes, biosRes] = await Promise.all([
    query<BrandKitRow>(
      `SELECT name, primary_color, secondary_color, accent_color, font_primary, font_secondary,
              tone_words, approved_phrases, banned_phrases, default_hashtags, is_default
       FROM brand_kit WHERE tenant_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT 1`,
      [tenantId],
    ),
    query<ProfileRow>(`SELECT brand_name, legal_name, website_url, tagline, bio_80, bio_150, bio_255, keywords, default_hashtags, approval_status FROM social_brand_profile ORDER BY created_at DESC LIMIT 1`),
    query<PlatformBioRow>(`SELECT platform, bio_text, bio_tier, status FROM social_platform_bio ORDER BY platform`),
  ]);

  const kit = kitRes.rows[0] ?? null;
  const profile = profileRes.rows[0] ?? null;
  const bios = biosRes.rows;

  if (!kit && !profile) {
    return Response.json({ error: 'No brand kit or brand profile has been created yet -- nothing real to export.' }, { status: 404 });
  }

  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const ensureSpace = (needed: number) => { if (y - needed < 50) { page = doc.addPage([595, 842]); y = 800; } };
  const draw = (text: string, opts: { size?: number; f?: typeof font; indent?: number; color?: [number, number, number] } = {}) => {
    const size = opts.size ?? 11;
    ensureSpace(size + 8);
    page.drawText(text, { x: 50 + (opts.indent ?? 0), y, size, font: opts.f ?? font, color: rgb(...(opts.color ?? [0.15, 0.15, 0.15])) });
    y -= size + 8;
  };
  const heading = (text: string) => { y -= 6; draw(text, { size: 15, f: bold, color: [0.1, 0.2, 0.4] }); y -= 2; };
  const swatch = (label: string, hex: string | undefined) => {
    ensureSpace(20);
    if (hex) page.drawRectangle({ x: 50, y: y - 12, width: 16, height: 16, color: rgb(...hexToRgb(hex)), borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 });
    page.drawText(`${label}: ${hex || '(not set)'}`, { x: 75, y: y - 8, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 24;
  };

  draw('Brand Guide', { size: 22, f: bold });
  draw(`Generated ${new Date().toISOString().slice(0, 10)}`, { size: 9, color: [0.5, 0.5, 0.5] });

  if (kit) {
    heading(`Visual Identity — ${kit.name}${kit.is_default ? ' (default)' : ''}`);
    swatch('Primary', kit.primary_color);
    swatch('Secondary', kit.secondary_color);
    swatch('Accent', kit.accent_color);
    draw(`Primary font: ${kit.font_primary}${kit.font_secondary ? ` · Secondary: ${kit.font_secondary}` : ''}`);
    draw(`Tone: ${kit.tone_words?.length ? kit.tone_words.join(', ') : '(not set)'}`);
    if (kit.approved_phrases?.length) draw(`Approved phrases: ${kit.approved_phrases.join(' · ')}`, { size: 9, color: [0.2, 0.5, 0.2] });
    if (kit.banned_phrases?.length) draw(`Banned phrases: ${kit.banned_phrases.join(' · ')}`, { size: 9, color: [0.6, 0.2, 0.2] });
    if (kit.default_hashtags?.length) draw(`Default hashtags: ${formatHashtags(kit.default_hashtags)}`, { size: 9, color: [0.3, 0.3, 0.6] });
  } else {
    heading('Visual Identity');
    draw('No brand kit created yet.', { color: [0.6, 0.6, 0.6] });
  }

  if (profile) {
    heading(`Brand Voice — ${profile.brand_name}`);
    if (profile.legal_name) draw(`Legal name: ${profile.legal_name}`, { size: 9, color: [0.5, 0.5, 0.5] });
    if (profile.website_url) draw(`Website: ${profile.website_url}`, { size: 9, color: [0.5, 0.5, 0.5] });
    if (profile.tagline) draw(`Tagline: "${profile.tagline}"`, { f: bold });
    draw(`Approval status: ${profile.approval_status}`, { size: 9, color: profile.approval_status === 'approved' ? [0.2, 0.5, 0.2] : [0.6, 0.5, 0.1] });
    y -= 4;
    draw('Short bio (80 char):', { f: bold, size: 10 });
    draw(profile.bio_80 || '(not set)', { indent: 10, size: 10 });
    draw('Medium bio (150 char):', { f: bold, size: 10 });
    draw(profile.bio_150 || '(not set)', { indent: 10, size: 10 });
    draw('Long bio (255 char):', { f: bold, size: 10 });
    draw(profile.bio_255 || '(not set)', { indent: 10, size: 10 });
    if (profile.keywords?.length) draw(`Keywords: ${profile.keywords.join(', ')}`, { size: 9, color: [0.4, 0.4, 0.4] });
    if (profile.default_hashtags?.length) draw(`Hashtags: ${formatHashtags(profile.default_hashtags)}`, { size: 9, color: [0.3, 0.3, 0.6] });
  } else {
    heading('Brand Voice');
    draw('No brand profile created yet.', { color: [0.6, 0.6, 0.6] });
  }

  heading('Per-Platform Bios');
  if (bios.length) {
    for (const b of bios) {
      draw(`${b.platform} (${b.bio_tier.replace('bio_', '')}-char, ${b.status})`, { f: bold, size: 11 });
      draw(b.bio_text, { indent: 10, size: 9, color: [0.3, 0.3, 0.3] });
    }
  } else {
    draw('No per-platform bios drafted yet.', { color: [0.6, 0.6, 0.6] });
  }

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="brand-guide.pdf"` },
  });
}
