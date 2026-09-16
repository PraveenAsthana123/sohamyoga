import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const risk = searchParams.get('risk_tolerance');
  const search = searchParams.get('search');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }
  if (risk) { conditions.push(`c.risk_tolerance = $${idx++}`); params.push(risk); }
  if (search) {
    conditions.push(`(c.name ILIKE $${idx} OR c.email ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT c.*,
        COUNT(a.id) AS account_count,
        COALESCE(SUM(a.current_value), 0) AS total_portfolio_value
      FROM fa_client c
      LEFT JOIN fa_account a ON a.client_id = c.id AND a.status = 'active'
      ${where}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 500
    `, params);
    return Response.json({ clients: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.name?.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO fa_client
        (name, email, phone, date_of_birth, province, employment_status, annual_income,
         net_worth, investable_assets, risk_tolerance, investment_horizon, primary_goal,
         retirement_age_target, tax_bracket, rrsp_room, tfsa_room, fhsa_eligible,
         status, kyc_completed, advisor_notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      b.name.trim(), b.email || null, b.phone || null,
      b.date_of_birth || null, b.province || 'AB',
      b.employment_status || null,
      b.annual_income ? Number(b.annual_income) : null,
      b.net_worth ? Number(b.net_worth) : null,
      b.investable_assets ? Number(b.investable_assets) : null,
      b.risk_tolerance || 'moderate',
      b.investment_horizon || null,
      b.primary_goal || null,
      b.retirement_age_target ? Number(b.retirement_age_target) : null,
      b.tax_bracket || null,
      b.rrsp_room ? Number(b.rrsp_room) : null,
      b.tfsa_room ? Number(b.tfsa_room) : null,
      b.fhsa_eligible === true,
      b.status || 'prospect',
      b.kyc_completed === true,
      b.advisor_notes || null,
    ]);
    return Response.json({ client: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
