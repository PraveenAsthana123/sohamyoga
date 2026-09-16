import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { id } = await params;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT * FROM retainer_invoices WHERE id = $1`, [id]
      );
      if (!rows.length) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
      return Response.json({ invoice: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('retainer-billing [id] GET error:', err);
    return Response.json({ error: 'Failed to fetch invoice.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const { status, payment_method, notes } = body;
    const VALID_STATUSES = ['pending', 'sent', 'paid', 'overdue'];
    if (status && !VALID_STATUSES.includes(status)) {
      return Response.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const isPaid = status === 'paid';
      const { rows, rowCount } = await client.query(
        `UPDATE retainer_invoices
         SET status = COALESCE($1, status),
             payment_method = COALESCE($2, payment_method),
             notes = COALESCE($3, notes),
             paid_at = CASE WHEN $4 AND paid_at IS NULL THEN NOW() ELSE paid_at END
         WHERE id = $5
         RETURNING *`,
        [status || null, payment_method || null, notes || null, isPaid, id]
      );
      if (!rowCount) return Response.json({ error: 'Invoice not found.' }, { status: 404 });
      return Response.json({ invoice: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('retainer-billing [id] PATCH error:', err);
    return Response.json({ error: 'Failed to update invoice.' }, { status: 500 });
  }
}
