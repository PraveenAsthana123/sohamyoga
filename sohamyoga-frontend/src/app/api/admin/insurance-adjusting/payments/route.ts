import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const conditions: string[] = [];
    const vals: unknown[] = [];
    const claimId = searchParams.get('claim_id');
    const paymentType = searchParams.get('payment_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    if (claimId) { conditions.push(`p.claim_id=$${vals.length+1}`); vals.push(claimId); }
    if (paymentType) { conditions.push(`p.payment_type=$${vals.length+1}`); vals.push(paymentType); }
    if (dateFrom) { conditions.push(`p.payment_date>=$${vals.length+1}`); vals.push(dateFrom); }
    if (dateTo) { conditions.push(`p.payment_date<=$${vals.length+1}`); vals.push(dateTo); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await client.query(
      `SELECT p.*, c.claim_number, c.insured_name
       FROM adj_payments p
       LEFT JOIN adj_claims c ON c.id=p.claim_id
       ${where} ORDER BY p.payment_date DESC`,
      vals
    );
    return Response.json({ payments: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.claim_id || !body?.amount || !body?.payee_name) {
    return Response.json({ error: 'claim_id, amount, payee_name required.' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO adj_payments (claim_id, payment_type, payee_name, payee_type, cheque_number, payment_date, amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.claim_id, body.payment_type ?? 'structural', body.payee_name, body.payee_type ?? 'insured', body.cheque_number, body.payment_date ?? new Date().toISOString().slice(0,10), body.amount, body.notes]
    );
    await client.query(`UPDATE adj_claims SET total_payments=total_payments+$2 WHERE id=$1`, [body.claim_id, body.amount]);
    await client.query('COMMIT');
    return Response.json({ payment: rows[0] }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adj payment POST error:', err);
    return Response.json({ error: 'Server error.' }, { status: 500 });
  } finally {
    client.release();
  }
}
