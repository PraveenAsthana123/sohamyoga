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
  const application_type = searchParams.get('application_type');
  const lender = searchParams.get('lender');
  const client_id = searchParams.get('client_id');

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) { conditions.push(`a.status = $${idx++}`); params.push(status); }
  if (application_type) { conditions.push(`a.application_type = $${idx++}`); params.push(application_type); }
  if (lender) { conditions.push(`a.lender = $${idx++}`); params.push(lender); }
  if (client_id) { conditions.push(`a.client_id = $${idx++}`); params.push(Number(client_id)); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT a.*, mc.name AS client_name, mc.credit_tier, mc.credit_score,
        mc.annual_income, mc.employment_type,
        json_agg(ls ORDER BY ls.submitted_at DESC) FILTER (WHERE ls.id IS NOT NULL) AS submissions
      FROM mortgage_application a
      JOIN mortgage_client mc ON mc.id = a.client_id
      LEFT JOIN mortgage_lender_submission ls ON ls.application_id = a.id
      ${where}
      GROUP BY a.id, mc.name, mc.credit_tier, mc.credit_score, mc.annual_income, mc.employment_type
      ORDER BY a.created_at DESC
      LIMIT 500
    `, params);
    return Response.json({ applications: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  if (!b || !b.client_id || !b.application_type) {
    return Response.json({ error: 'client_id and application_type required.' }, { status: 400 });
  }

  // Auto-calculate CMHC premium if applicable
  let cmhcPremium: number | null = null;
  let cmhcInsured = false;
  const price = b.purchase_price ? Number(b.purchase_price) : 0;
  const down = b.down_payment ? Number(b.down_payment) : 0;
  const mortgage = b.mortgage_amount ? Number(b.mortgage_amount) : (price - down);
  const downPct = price > 0 ? (down / price) * 100 : 0;

  if (price <= 1500000 && downPct >= 5 && downPct < 20 && b.application_type === 'purchase') {
    cmhcInsured = true;
    const ltvPct = (mortgage / price) * 100;
    let rate = 0;
    if (ltvPct <= 80) rate = 0;
    else if (ltvPct <= 85) rate = 0.028;
    else if (ltvPct <= 90) rate = 0.031;
    else rate = 0.04;
    cmhcPremium = mortgage * rate;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO mortgage_application
        (client_id, application_type, property_type, property_address, property_city, property_province,
         purchase_price, appraised_value, down_payment, down_payment_pct, mortgage_amount,
         cmhc_insured, cmhc_premium, requested_rate, rate_type, amortization_years, term_years,
         payment_frequency, lender, lender_rate, status, conditions, closing_date, broker_fee, finder_fee_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING *
    `, [
      Number(b.client_id), b.application_type,
      b.property_type || null, b.property_address || null,
      b.property_city || 'Calgary', b.property_province || 'AB',
      price || null, b.appraised_value ? Number(b.appraised_value) : null,
      down || null, Number(downPct.toFixed(2)) || null,
      mortgage || null,
      cmhcInsured, cmhcPremium,
      b.requested_rate ? Number(b.requested_rate) : null,
      b.rate_type || 'fixed',
      b.amortization_years ? Number(b.amortization_years) : 25,
      b.term_years ? Number(b.term_years) : 5,
      b.payment_frequency || 'monthly',
      b.lender || null, b.lender_rate ? Number(b.lender_rate) : null,
      b.status || 'draft',
      b.conditions || null,
      b.closing_date || null,
      b.broker_fee ? Number(b.broker_fee) : null,
      b.finder_fee_pct ? Number(b.finder_fee_pct) : null,
    ]);
    return Response.json({ application: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
