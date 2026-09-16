import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid ID.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.*, ic.name AS client_name, ic.phone AS client_phone, ic.email AS client_email
      FROM insurance_policy p
      JOIN insurance_client ic ON ic.id = p.client_id
      WHERE p.id = $1
    `, [id]);

    if (!result.rowCount) return Response.json({ error: 'Policy not found.' }, { status: 404 });
    return Response.json({ policy: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return Response.json({ error: 'Invalid ID.' }, { status: 400 });

  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Handle /renew action
    if (b.action === 'renew') {
      const orig = await client.query('SELECT * FROM insurance_policy WHERE id = $1', [id]);
      if (!orig.rowCount) return Response.json({ error: 'Policy not found.' }, { status: 404 });
      const p = orig.rows[0];
      const newEffective = b.effective_date || p.expiry_date;
      const newExpiry = b.expiry_date || null;
      const result = await client.query(`
        INSERT INTO insurance_policy
          (client_id, policy_type, insurer, coverage_amount, annual_premium, monthly_premium,
           deductible, effective_date, expiry_date, status, coverage_details,
           broker_commission_pct, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'quoted',$10,$11,$12)
        RETURNING *
      `, [p.client_id, p.policy_type, p.insurer, p.coverage_amount, p.annual_premium,
          p.monthly_premium, p.deductible, newEffective, newExpiry,
          p.coverage_details, p.broker_commission_pct, `Renewal of policy #${id}`]);
      return Response.json({ policy: result.rows[0] }, { status: 201 });
    }

    const result = await client.query(`
      UPDATE insurance_policy SET
        policy_type = COALESCE($2, policy_type),
        insurer = COALESCE($3, insurer),
        policy_number = COALESCE($4, policy_number),
        coverage_amount = COALESCE($5, coverage_amount),
        annual_premium = COALESCE($6, annual_premium),
        monthly_premium = COALESCE($7, monthly_premium),
        deductible = COALESCE($8, deductible),
        effective_date = COALESCE($9, effective_date),
        expiry_date = COALESCE($10, expiry_date),
        status = COALESCE($11, status),
        coverage_details = COALESCE($12::jsonb, coverage_details),
        broker_commission_pct = COALESCE($13, broker_commission_pct),
        broker_commission_amt = COALESCE($14, broker_commission_amt),
        renewal_reminder_sent = COALESCE($15, renewal_reminder_sent),
        notes = COALESCE($16, notes)
      WHERE id = $1
      RETURNING *
    `, [id, b.policy_type, b.insurer, b.policy_number, b.coverage_amount, b.annual_premium,
        b.monthly_premium, b.deductible, b.effective_date, b.expiry_date, b.status,
        b.coverage_details ? JSON.stringify(b.coverage_details) : null,
        b.broker_commission_pct, b.broker_commission_amt, b.renewal_reminder_sent, b.notes]);

    if (!result.rowCount) return Response.json({ error: 'Policy not found.' }, { status: 404 });
    return Response.json({ policy: result.rows[0] });
  } finally {
    client.release();
  }
}
