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
      const [tenantRes, rentRes] = await Promise.all([
        client.query(`SELECT t.*, p.address FROM pm_tenant t LEFT JOIN pm_property p ON p.id=t.property_id WHERE t.id=$1`, [id]),
        client.query(`SELECT * FROM pm_rent_payment WHERE tenant_id=$1 ORDER BY due_date DESC`, [id]),
      ]);
      if (!tenantRes.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...tenantRes.rows[0], rent_history: rentRes.rows });
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
    const fields = ['property_id','first_name','last_name','email','phone','unit_number','lease_start','lease_end','monthly_rent','security_deposit','status','emergency_contact_name','emergency_contact_phone','notes'];
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
      const { rows } = await client.query(`UPDATE pm_tenant SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING *`, vals);
      if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
