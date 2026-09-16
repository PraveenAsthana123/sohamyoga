import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['vendor_name','contact_name','phone','email','website','commission_pct','notes','is_active'];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${values.length+1}`); values.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    values.push(params.id);
    const r = await client.query(`UPDATE wv_vendor_preferred SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`, values);
    return Response.json({ vendor: r.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE wv_vendor_preferred SET is_active=false WHERE id=$1`, [params.id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
