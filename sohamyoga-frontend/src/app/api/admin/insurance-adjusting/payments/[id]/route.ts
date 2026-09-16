import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT p.*, c.claim_number, c.insured_name, c.insurer_name FROM adj_payments p LEFT JOIN adj_claims c ON c.id=p.claim_id WHERE p.id=$1`,
      [params.id]
    );
    if (!rows.length) return Response.json({ error: 'Payment not found.' }, { status: 404 });
    return Response.json({ payment: rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE adj_payments SET
        payment_type=COALESCE($2,payment_type),
        payee_name=COALESCE($3,payee_name),
        payee_type=COALESCE($4,payee_type),
        cheque_number=COALESCE($5,cheque_number),
        payment_date=COALESCE($6,payment_date),
        amount=COALESCE($7,amount),
        notes=COALESCE($8,notes)
       WHERE id=$1 RETURNING *`,
      [params.id, body.payment_type, body.payee_name, body.payee_type, body.cheque_number, body.payment_date, body.amount, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Payment not found.' }, { status: 404 });
    return Response.json({ payment: rows[0] });
  } finally {
    client.release();
  }
}
