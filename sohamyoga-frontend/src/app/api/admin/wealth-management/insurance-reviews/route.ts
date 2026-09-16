import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT r.*, c.first_name, c.last_name FROM wm_insurance_review r JOIN wm_client c ON c.id=r.client_id WHERE 1=1`;
      const params: any[] = [];
      if (client_id) { params.push(parseInt(client_id)); q += ` AND r.client_id=$${params.length}`; }
      q += ` ORDER BY r.review_date DESC`;
      const { rows } = await client.query(q, params);
      return NextResponse.json(rows);
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO wm_insurance_review (client_id, review_date, life_insurance_provider, life_coverage, life_premium,
          disability_provider, disability_benefit, disability_premium, critical_illness_provider, ci_coverage, ci_premium,
          health_dental_provider, health_dental_premium, home_insurance_provider, home_premium,
          auto_insurance_provider, auto_premium, gaps_identified, recommendations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [body.client_id, body.review_date || new Date().toISOString().split('T')[0],
          body.life_insurance_provider||null, body.life_coverage||null, body.life_premium||null,
          body.disability_provider||null, body.disability_benefit||null, body.disability_premium||null,
          body.critical_illness_provider||null, body.ci_coverage||null, body.ci_premium||null,
          body.health_dental_provider||null, body.health_dental_premium||null,
          body.home_insurance_provider||null, body.home_premium||null,
          body.auto_insurance_provider||null, body.auto_premium||null,
          body.gaps_identified||[], body.recommendations||null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
