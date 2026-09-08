import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AD_TYPES = ['responsive_search', 'display', 'banner', 'video', 'image', 'dynamic', 'call'];

// Real Dynamic Ad Builder -- the advertisement table already stored
// headlines[]/descriptions[] arrays (RSA-style, up to 15/4 per
// Advertisement.ts) and ai-generated creatives could reach it via
// generate-creative, but there was no manual multi-headline/description
// creation path -- creatives could only be viewed (GET), never built here.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as {
    adGroupId?: string; name?: string; adType?: string;
    headlines?: string[]; descriptions?: string[]; finalUrl?: string; callToAction?: string;
  } | null;

  const headlines = (body?.headlines ?? []).map(h => h.trim()).filter(Boolean);
  const descriptions = (body?.descriptions ?? []).map(d => d.trim()).filter(Boolean);

  if (!body?.adGroupId || !body?.name?.trim() || !AD_TYPES.includes(body.adType ?? '') || !body?.finalUrl?.trim()) {
    return Response.json({ error: `adGroupId, name, a valid adType (${AD_TYPES.join('|')}), and finalUrl are required.` }, { status: 400 });
  }
  if (headlines.length < 1 || headlines.length > 15) {
    return Response.json({ error: 'Provide between 1 and 15 headlines.' }, { status: 400 });
  }
  if (descriptions.length < 1 || descriptions.length > 4) {
    return Response.json({ error: 'Provide between 1 and 4 descriptions.' }, { status: 400 });
  }
  const adGroup = await query(`SELECT 1 FROM ad_group WHERE id = $1`, [body.adGroupId]);
  if (!adGroup.rowCount) return Response.json({ error: 'Ad group not found.' }, { status: 404 });

  const result = await query<{ id: string }>(
    `INSERT INTO advertisement (ad_group_id, name, ad_type, headlines, descriptions, final_url, call_to_action, ai_generated, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,'under_review') RETURNING id`,
    [body.adGroupId, body.name.trim(), body.adType, headlines, descriptions, body.finalUrl.trim(), body.callToAction?.trim() || null],
  );
  return Response.json({ ok: true, id: result.rows[0].id, variantCount: headlines.length * descriptions.length }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{
    id: string; name: string; ad_type: string; status: string; ai_generated: boolean;
    impression_count: string; click_count: string; spend_cents: string;
  }>(
    `SELECT id, name, ad_type::text, status::text, ai_generated, impression_count, click_count, spend_cents
     FROM advertisement ORDER BY created_at DESC`,
  );

  return Response.json({
    creatives: rows.rows.map(a => {
      const impressions = Number(a.impression_count);
      const clicks = Number(a.click_count);
      const spend = Number(a.spend_cents) / 100;
      return {
        id: a.id, name: a.name, type: a.ad_type, status: a.status, ai: a.ai_generated,
        impressions, clicks,
        ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks ? Math.round((spend / clicks) * 100) / 100 : 0,
      };
    }),
  });
}
