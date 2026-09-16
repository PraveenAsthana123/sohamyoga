import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const { settlement_amount, final_payment_note, payee_name } = body;
  if (!settlement_amount || settlement_amount <= 0) {
    return Response.json({ error: 'settlement_amount required and must be > 0.' }, { status: 400 });
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE adj_claims SET status='closed', total_payments=total_payments+$2 WHERE id=$1 RETURNING *`,
      [params.id, settlement_amount]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return Response.json({ error: 'Claim not found.' }, { status: 404 }); }
    if (payee_name) {
      await client.query(
        `INSERT INTO adj_payments (claim_id, payment_type, payee_name, payee_type, payment_date, amount, notes)
         VALUES ($1, 'total_loss', $2, 'insured', CURRENT_DATE, $3, $4)`,
        [params.id, payee_name, settlement_amount, final_payment_note ?? 'Final settlement payment']
      );
    }
    await client.query('COMMIT');
    return Response.json({ claim: rows[0], message: 'Claim closed successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('close claim error:', err);
    return Response.json({ error: 'Server error.' }, { status: 500 });
  } finally {
    client.release();
  }
}
