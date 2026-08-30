// Shared load/save for BrandKit, mirroring src/domain/video/videoRepository.ts —
// centralizes the row->props mapping so every route that needs the real domain
// object (not just a flat listing) shares one place to update it.
import { query } from '@/lib/postgres';
import { BrandKit, type BrandKitProps } from './BrandKit';

interface BrandKitRow {
  id: string; tenant_id: string; name: string;
  primary_color: string; secondary_color: string; accent_color: string;
  logo_url: string; dark_logo_url: string | null;
  font_primary: string; font_secondary: string | null;
  tone_words: BrandKitProps['toneWords']; approved_phrases: string[]; banned_phrases: string[];
  default_hashtags: string[]; is_default: boolean;
  updated_by: string; updated_at: Date; created_at: Date;
}

function rowToBrandKit(r: BrandKitRow): BrandKit {
  return new BrandKit({
    id: r.id, tenantId: r.tenant_id, name: r.name,
    primaryColor: r.primary_color, secondaryColor: r.secondary_color, accentColor: r.accent_color,
    logoUrl: r.logo_url, darkLogoUrl: r.dark_logo_url ?? undefined,
    fontPrimary: r.font_primary, fontSecondary: r.font_secondary ?? undefined,
    toneWords: r.tone_words, approvedPhrases: r.approved_phrases, bannedPhrases: r.banned_phrases,
    defaultHashtags: r.default_hashtags, isDefault: r.is_default,
    updatedBy: r.updated_by, updatedAt: new Date(r.updated_at),
  });
}

export async function loadBrandKit(id: string): Promise<BrandKit | null> {
  const rows = await query<BrandKitRow>(
    `SELECT id, tenant_id, name, primary_color, secondary_color, accent_color,
            logo_url, dark_logo_url, font_primary, font_secondary,
            tone_words, approved_phrases, banned_phrases, default_hashtags, is_default,
            updated_by, updated_at, created_at
     FROM brand_kit WHERE id = $1`,
    [id],
  );
  if (!rows.rows.length) return null;
  return rowToBrandKit(rows.rows[0]);
}

export async function listBrandKits(tenantId: string): Promise<BrandKit[]> {
  const rows = await query<BrandKitRow>(
    `SELECT id, tenant_id, name, primary_color, secondary_color, accent_color,
            logo_url, dark_logo_url, font_primary, font_secondary,
            tone_words, approved_phrases, banned_phrases, default_hashtags, is_default,
            updated_by, updated_at, created_at
     FROM brand_kit WHERE tenant_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [tenantId],
  );
  return rows.rows.map(rowToBrandKit);
}

export async function saveBrandKitState(kit: BrandKit): Promise<void> {
  const p = kit.toJSON();
  await query(
    `UPDATE brand_kit SET
       primary_color = $2, secondary_color = $3, accent_color = $4,
       approved_phrases = $5, banned_phrases = $6, default_hashtags = $7,
       updated_by = $8, updated_at = $9
     WHERE id = $1`,
    [p.id, p.primaryColor, p.secondaryColor, p.accentColor,
      p.approvedPhrases, p.bannedPhrases, p.defaultHashtags,
      p.updatedBy, p.updatedAt],
  );
}
