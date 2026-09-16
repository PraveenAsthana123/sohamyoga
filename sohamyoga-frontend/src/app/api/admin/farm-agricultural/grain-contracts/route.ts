import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const commodity = searchParams.get('commodity');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (client_id) { conditions.push(`gc.client_id=$${vals.length + 1}`); vals.push(client_id); }
    if (commodity) { conditions.push(`gc.commodity ILIKE $${vals.length + 1}`); vals.push(`%${commodity}%`); }
    if (status) { conditions.push(`gc.status=$${vals.length + 1}`); vals.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT gc.*, c.farm_name, c.operator_name FROM ag_grain_contracts gc
         JOIN ag_clients c ON c.id=gc.client_id
         ${where} ORDER BY gc.delivery_end DESC`, vals
      );
      return Response.json({ contracts: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag grain-contracts GET error:', err);
    return Response.json({ error: 'Failed to fetch contracts.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => null);
    if (!body?.client_id || !body?.commodity) return Response.json({ error: 'client_id and commodity are required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ag_grain_contracts (client_id, commodity, contract_type, bushels_contracted, price_per_bu, basis_level, delivery_start, delivery_end, buyer_name, elevator_location, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [body.client_id, body.commodity, body.contract_type ?? 'basis', body.bushels_contracted, body.price_per_bu, body.basis_level, body.delivery_start, body.delivery_end, body.buyer_name, body.elevator_location, body.status ?? 'open', body.notes]
      );
      return Response.json({ contract: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag grain-contracts POST error:', err);
    return Response.json({ error: 'Failed to create contract.' }, { status: 500 });
  }
}
