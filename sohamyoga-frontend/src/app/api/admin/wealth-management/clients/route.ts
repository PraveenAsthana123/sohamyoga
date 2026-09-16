import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const client_type = searchParams.get('client_type');
    const status = searchParams.get('status');
    const planner = searchParams.get('planner');
    const pool = getPool();
    const client = await pool.connect();
    try {
      let q = `SELECT c.*, COALESCE(s.net_worth, 0) AS latest_net_worth, s.snapshot_date AS last_snapshot_date
        FROM wm_client c
        LEFT JOIN LATERAL (SELECT net_worth, snapshot_date FROM wm_financial_snapshot WHERE client_id=c.id ORDER BY snapshot_date DESC LIMIT 1) s ON true
        WHERE 1=1`;
      const params: any[] = [];
      if (client_type) { params.push(client_type); q += ` AND c.client_type=$${params.length}`; }
      if (status) { params.push(status); q += ` AND c.status=$${params.length}`; }
      if (planner) { params.push(planner); q += ` AND c.current_planner=$${params.length}`; }
      q += ` ORDER BY c.last_name, c.first_name`;
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
        `INSERT INTO wm_client (first_name, last_name, email, phone, date_of_birth, province, marital_status, dependents,
          employment_status, employer, annual_income, spouse_income, client_type, financial_goals, risk_tolerance,
          current_planner, review_frequency, next_review_date, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [body.first_name, body.last_name, body.email, body.phone || null, body.date_of_birth || null,
          body.province || 'AB', body.marital_status || null, body.dependents || 0,
          body.employment_status || null, body.employer || null, body.annual_income || null,
          body.spouse_income || null, body.client_type || 'individual',
          body.financial_goals || [], body.risk_tolerance || 'moderate',
          body.current_planner || null, body.review_frequency || 'annual',
          body.next_review_date || null, body.status || 'active', body.notes || null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
