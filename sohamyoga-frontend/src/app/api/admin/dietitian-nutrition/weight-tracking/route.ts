import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');

    if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 });

    const result = await client.query(
      `SELECT w.*, c.first_name, c.last_name
       FROM dn_weight_entries w
       LEFT JOIN dn_clients c ON c.id=w.client_id
       WHERE w.client_id=$1 ORDER BY w.recorded_at DESC LIMIT 100`,
      [client_id]
    );
    return Response.json({ weight_entries: result.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { client_id, weight_kg, notes, recorded_at } = body;
    if (!client_id || !weight_kg) return Response.json({ error: 'client_id and weight_kg required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO dn_weight_entries (client_id, weight_kg, notes, recorded_at)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [client_id, weight_kg, notes||null, recorded_at||new Date().toISOString()]
    );
    return Response.json({ weight_entry: result.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
