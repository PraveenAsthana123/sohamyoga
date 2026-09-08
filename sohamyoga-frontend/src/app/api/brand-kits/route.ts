import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin, getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { BrandKit, type ToneWord } from '@/domain/marketing/BrandKit';
import { computeBrandHealth } from '@/domain/branding/BrandHealthScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const rows = await query(
    `SELECT id, name, primary_color, secondary_color, accent_color, logo_url, dark_logo_url,
            font_primary, font_secondary, tone_words, approved_phrases, banned_phrases,
            default_hashtags, is_default, updated_by, updated_at, created_at
     FROM brand_kit WHERE tenant_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [tenantId],
  );
  return Response.json({
    brandKits: rows.rows.map(r => {
      const kit = {
        logoUrl: r.logo_url, darkLogoUrl: r.dark_logo_url, primaryColor: r.primary_color,
        secondaryColor: r.secondary_color, accentColor: r.accent_color, fontPrimary: r.font_primary,
        fontSecondary: r.font_secondary, toneWords: r.tone_words, approvedPhrases: r.approved_phrases,
        bannedPhrases: r.banned_phrases, defaultHashtags: r.default_hashtags,
      };
      return {
        id: r.id, name: r.name, primaryColor: r.primary_color, secondaryColor: r.secondary_color,
        accentColor: r.accent_color, logoUrl: r.logo_url, darkLogoUrl: r.dark_logo_url,
        fontPrimary: r.font_primary, fontSecondary: r.font_secondary,
        toneWords: r.tone_words, approvedPhrases: r.approved_phrases, bannedPhrases: r.banned_phrases,
        defaultHashtags: r.default_hashtags, isDefault: r.is_default,
        updatedBy: r.updated_by, updatedAt: r.updated_at, createdAt: r.created_at,
        health: computeBrandHealth(kit),
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    name?: string; primaryColor?: string; secondaryColor?: string; accentColor?: string;
    logoUrl?: string; darkLogoUrl?: string; fontPrimary?: string; fontSecondary?: string;
    toneWords?: ToneWord[]; approvedPhrases?: string[]; bannedPhrases?: string[]; defaultHashtags?: string[];
    isDefault?: boolean;
  } | null;
  if (!body?.name || !body.primaryColor || !body.secondaryColor || !body.accentColor || !body.logoUrl || !body.fontPrimary) {
    return Response.json({ error: 'name, primaryColor, secondaryColor, accentColor, logoUrl, and fontPrimary are required.' }, { status: 400 });
  }

  const now = new Date();
  try {
    new BrandKit({
      id: '00000000-0000-0000-0000-000000000000', tenantId: '00000000-0000-0000-0000-000000000000',
      name: body.name, primaryColor: body.primaryColor, secondaryColor: body.secondaryColor,
      accentColor: body.accentColor, logoUrl: body.logoUrl, darkLogoUrl: body.darkLogoUrl,
      fontPrimary: body.fontPrimary, fontSecondary: body.fontSecondary,
      toneWords: body.toneWords ?? ['warm'], approvedPhrases: body.approvedPhrases ?? [],
      bannedPhrases: body.bannedPhrases ?? [], defaultHashtags: body.defaultHashtags ?? [],
      isDefault: body.isDefault ?? false, updatedBy: principal!.id, updatedAt: now,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Invalid brand kit data.' }, { status: 400 });
  }

  const tenantId = await getPrimaryTenantId();
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO brand_kit (tenant_id, name, primary_color, secondary_color, accent_color, logo_url, dark_logo_url,
                               font_primary, font_secondary, tone_words, approved_phrases, banned_phrases,
                               default_hashtags, is_default, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [tenantId, body.name, body.primaryColor, body.secondaryColor, body.accentColor, body.logoUrl,
        body.darkLogoUrl ?? null, body.fontPrimary, body.fontSecondary ?? null,
        body.toneWords ?? ['warm'], body.approvedPhrases ?? [], body.bannedPhrases ?? [],
        body.defaultHashtags ?? [], body.isDefault ?? false, principal!.id],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('uq_brand_kit_default') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'A default brand kit already exists for this tenant.' : message }, { status });
  }
}
