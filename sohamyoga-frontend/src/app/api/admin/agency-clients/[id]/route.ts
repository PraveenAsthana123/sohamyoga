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
        `SELECT * FROM agency_clients WHERE id = $1`, [id]
      );
      if (!rows.length) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agency-clients [id] GET error:', err);
    return Response.json({ error: 'Failed to fetch client.' }, { status: 500 });
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

    const allowed = [
      'company_name', 'industry', 'contact_name', 'contact_email', 'contact_phone',
      'account_manager', 'status', 'monthly_retainer_cad', 'contract_start',
      'contract_end', 'total_spend_cad', 'health_score', 'tags', 'notes',
    ];
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }
    if (!setClauses.length) return Response.json({ error: 'No updatable fields provided.' }, { status: 400 });
    values.push(id);

    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows, rowCount } = await client.query(
        `UPDATE agency_clients SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ client: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agency-clients [id] PATCH error:', err);
    return Response.json({ error: 'Failed to update client.' }, { status: 500 });
  }
}

export async function DELETE(
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
      const { rowCount } = await client.query(
        `DELETE FROM agency_clients WHERE id = $1`, [id]
      );
      if (!rowCount) return Response.json({ error: 'Client not found.' }, { status: 404 });
      return Response.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agency-clients [id] DELETE error:', err);
    return Response.json({ error: 'Failed to delete client.' }, { status: 500 });
  }
}
