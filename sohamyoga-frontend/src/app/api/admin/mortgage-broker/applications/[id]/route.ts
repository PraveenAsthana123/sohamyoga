import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT a.*, mc.name AS client_name, mc.email AS client_email,
        mc.credit_tier, mc.credit_score, mc.annual_income, mc.co_applicant_income,
        mc.employment_type, mc.monthly_obligations, mc.total_debt,
        json_agg(ls ORDER BY ls.submitted_at DESC) FILTER (WHERE ls.id IS NOT NULL) AS submissions
      FROM mortgage_application a
      JOIN mortgage_client mc ON mc.id = a.client_id
      LEFT JOIN mortgage_lender_submission ls ON ls.application_id = a.id
      WHERE a.id = $1
      GROUP BY a.id, mc.name, mc.email, mc.credit_tier, mc.credit_score,
        mc.annual_income, mc.co_applicant_income, mc.employment_type,
        mc.monthly_obligations, mc.total_debt
    `, [id]);
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ application: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const allowed = ['application_type','property_type','property_address','property_city','property_province',
    'purchase_price','appraised_value','down_payment','down_payment_pct','mortgage_amount',
    'cmhc_insured','cmhc_premium','requested_rate','rate_type','amortization_years','term_years',
    'payment_frequency','lender','lender_rate','status','conditions','closing_date',
    'funded_date','broker_fee','finder_fee_pct'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in b) { sets.push(`${key} = $${idx++}`); vals.push(b[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  vals.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE mortgage_application SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ application: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM mortgage_application WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
