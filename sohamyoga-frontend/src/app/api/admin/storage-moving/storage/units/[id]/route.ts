import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: [unit] } = await client.query(`SELECT * FROM sm_storage_unit WHERE id = $1`, [params.id]);
    if (!unit) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: rental } = await client.query(`SELECT sr.*, c.first_name, c.last_name, c.phone FROM sm_storage_rental sr JOIN sm_customer c ON c.id = sr.customer_id WHERE sr.unit_id = $1 AND sr.status = 'active' LIMIT 1`, [params.id]);
    return Response.json({ ...unit, current_rental: rental[0] ?? null });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const fields = ['unit_size','unit_type','monthly_rate','floor','building'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) { vals.push(b[f]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'Nothing to update' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE sm_storage_unit SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}
