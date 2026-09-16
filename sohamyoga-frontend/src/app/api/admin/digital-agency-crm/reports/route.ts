import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('client_id');
    const month = searchParams.get('month');
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (clientId) { conditions.push(`r.client_id=$${params.length + 1}`); params.push(clientId); }
    if (month) { conditions.push(`r.report_month=$${params.length + 1}`); params.push(month); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT r.*, cl.company_name FROM dac_report r
       LEFT JOIN dac_client cl ON cl.id=r.client_id
       ${where} ORDER BY r.report_month DESC, r.created_at DESC`,
      params
    );
    return Response.json(rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO dac_report (client_id, report_month, total_impressions, total_clicks, total_conversions, total_spend, roas, top_performing_campaign, seo_keywords_top10, organic_traffic_growth_pct, social_followers_gained, email_open_rate, report_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [body.client_id, body.report_month, body.total_impressions || null, body.total_clicks || null,
       body.total_conversions || null, body.total_spend || null, body.roas || null,
       body.top_performing_campaign, body.seo_keywords_top10 || null,
       body.organic_traffic_growth_pct || null, body.social_followers_gained || null,
       body.email_open_rate || null, body.report_url || null]
    );
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
