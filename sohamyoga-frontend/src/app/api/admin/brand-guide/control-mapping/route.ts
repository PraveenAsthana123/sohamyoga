import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real Control Mapping Screen -- maps each brand_kit guideline field to how
// it is ACTUALLY enforced in code today, read directly off real enforcement
// paths rather than an aspirational policy document:
//   - banned_phrases: automated, blocking -- checkBrandCompliance()
//     (src/domain/branding/BrandComplianceChecker.ts) flags any match,
//     driving the violations queue at /admin/brand-kits.
//   - approved_phrases: automated, informational only -- same function
//     reports usesApprovedPhrase but never blocks on its absence.
//   - tone_words: presence-checked only -- computeBrandHealth()
//     (src/domain/branding/BrandHealthScore.ts) scores whether >=3 are
//     defined, but no code path checks that content actually matches the
//     declared tone.
//   - colors / fonts / logo / default_hashtags: manual/visual only -- no
//     automated enforcement exists anywhere in this codebase.
const CONTROLS = [
  { field: 'banned_phrases', label: 'Banned Phrases', enforcement: 'automated_blocking', enforcedBy: 'BrandComplianceChecker.checkBrandCompliance (flags violations)' },
  { field: 'approved_phrases', label: 'Approved Phrases', enforcement: 'automated_informational', enforcedBy: 'BrandComplianceChecker.checkBrandCompliance (usesApprovedPhrase flag, non-blocking)' },
  { field: 'tone_words', label: 'Tone Words', enforcement: 'presence_checked_only', enforcedBy: 'BrandHealthScore.computeBrandHealth (>=3 defined = pass, content not checked against tone)' },
  { field: 'primary_color', label: 'Primary Color', enforcement: 'manual_visual_only', enforcedBy: null },
  { field: 'secondary_color', label: 'Secondary Color', enforcement: 'manual_visual_only', enforcedBy: null },
  { field: 'accent_color', label: 'Accent Color', enforcement: 'manual_visual_only', enforcedBy: null },
  { field: 'font_primary', label: 'Primary Font', enforcement: 'manual_visual_only', enforcedBy: null },
  { field: 'default_hashtags', label: 'Default Hashtags', enforcement: 'manual_visual_only', enforcedBy: null },
] as const;

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const kit = await query<{
    banned_phrases: string[]; approved_phrases: string[]; tone_words: string[]; default_hashtags: string[];
    primary_color: string; secondary_color: string; accent_color: string; font_primary: string;
  }>(
    `SELECT banned_phrases, approved_phrases, tone_words, default_hashtags, primary_color, secondary_color, accent_color, font_primary
     FROM brand_kit WHERE tenant_id = $1 AND is_default = true LIMIT 1`,
    [tenantId],
  );
  const k = kit.rows[0];
  const liveCount = (field: string): number | string => {
    if (!k) return 'n/a';
    switch (field) {
      case 'banned_phrases': return k.banned_phrases.length;
      case 'approved_phrases': return k.approved_phrases.length;
      case 'tone_words': return k.tone_words.length;
      case 'default_hashtags': return k.default_hashtags.length;
      case 'primary_color': return k.primary_color;
      case 'secondary_color': return k.secondary_color;
      case 'accent_color': return k.accent_color;
      case 'font_primary': return k.font_primary;
      default: return 'n/a';
    }
  };

  return Response.json({
    hasDefaultKit: (kit.rowCount ?? 0) > 0,
    controls: CONTROLS.map(c => ({ ...c, currentValue: liveCount(c.field) })),
  });
}
