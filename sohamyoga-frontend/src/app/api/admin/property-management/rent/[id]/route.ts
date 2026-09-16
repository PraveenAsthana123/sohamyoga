import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const id = parseInt(params.id, 10);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT r.*, t.first_name, t.last_name, p.address
        FROM pm_rent_payment r
        LEFT JOIN pm_tenant t ON t.id=r.tenant_id
        LEFT JOIN pm_property p ON p.id=r.property_id
        WHERE r.id=$1
      `, [id]);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const id = parseInt(params.id, 10);
    const fields = ['status','paid_date','payment_method','late_fee','notes','amount'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const f of fields) {
      if (body[f] !== undefined) { vals.push(body[f]); sets.push(`${f}=$${vals.length}`); }
    }
    if (!sets.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
    vals.push(id);
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`UPDATE pm_rent_payment SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
