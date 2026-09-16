import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const allowed = ['contact_name','relationship','phone','is_emergency_contact','is_aware_of_treatment','notes'];
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const f of allowed) {
      if (b[f] !== undefined) { updates.push(`${f} = $${idx++}`); vals.push(b[f]); }
    }
    if (!updates.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const { rows } = await client.query(`UPDATE mh_crisis_contact SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return Response.json(rows[0]);
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const authRes = await requireAdmin(req);
  if (authRes) return authRes;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM mh_crisis_contact WHERE id = $1`, [params.id]);
    return Response.json({ ok: true });
  } finally { client.release(); }
}
