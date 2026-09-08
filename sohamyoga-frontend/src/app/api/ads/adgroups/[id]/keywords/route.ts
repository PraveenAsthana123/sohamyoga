import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MATCH_TYPES = ['broad', 'phrase', 'exact'];

// Real Keyword Management -- ad_keyword existed in the schema with zero
// create/edit routes anywhere (confirmed: only ever read for a dashboard
// count). Manual keyword entry only -- no real keyword-research/search-
// volume data source is connected in this environment.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const rows = await query(
    `SELECT id, text, match_type, bid_adjustment_percent, is_negative, created_at
     FROM ad_keyword WHERE ad_group_id = $1 ORDER BY created_at DESC`,
    [id],
  );
  return Response.json({
    keywords: rows.rows.map(r => ({
      id: r.id, text: r.text, matchType: r.match_type, bidAdjustmentPercent: r.bid_adjustment_percent,
      isNegative: r.is_negative, createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    text?: string; matchType?: string; bidAdjustmentPercent?: number; isNegative?: boolean;
  } | null;
  if (!body?.text?.trim() || !body.matchType || !MATCH_TYPES.includes(body.matchType)) {
    return Response.json({ error: `text and a valid matchType (${MATCH_TYPES.join('|')}) are required.` }, { status: 400 });
  }

  const adGroup = await query(`SELECT 1 FROM ad_group WHERE id = $1`, [id]);
  if (!adGroup.rowCount) return Response.json({ error: 'Ad group not found.' }, { status: 404 });

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO ad_keyword (ad_group_id, text, match_type, bid_adjustment_percent, is_negative)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [id, body.text.trim(), body.matchType, body.bidAdjustmentPercent ?? null, Boolean(body.isNegative)],
    );
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('ad_keyword_ad_group_id_text_match_type_key')) {
      return Response.json({ error: 'This keyword + match type already exists for this ad group.' }, { status: 409 });
    }
    throw err;
  }
}
