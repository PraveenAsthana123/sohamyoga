export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const allowed = ['appointment_date','duration_minutes','provider_name','service_type','status','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of allowed) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);

    const r = await client.query(`UPDATE healthcare_appointment SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ appointment: r.rows[0] });
  } finally {
    client.release();
  }
}
