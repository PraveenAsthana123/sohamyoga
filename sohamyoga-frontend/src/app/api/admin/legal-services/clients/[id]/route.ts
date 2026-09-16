export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const [lc, matters] = await Promise.all([
      client.query(`SELECT * FROM legal_client WHERE id=$1`, [params.id]),
      client.query(`
        SELECT lm.*,
          (SELECT COUNT(*) FROM legal_time_entry WHERE matter_id=lm.id AND billed=false) AS unbilled_entries,
          (SELECT COALESCE(SUM(hours*rate),0) FROM legal_time_entry WHERE matter_id=lm.id AND billed=false) AS unbilled_amount,
          (SELECT COUNT(*) FROM legal_deadline WHERE matter_id=lm.id AND status='pending') AS pending_deadlines
        FROM legal_matter lm WHERE lm.client_id=$1 ORDER BY lm.created_at DESC
      `, [params.id]),
    ]);

    if (!lc.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ client: lc.rows[0], matters: matters.rows });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const body = await req.json();
    const fields = ['name','email','phone','company_name','address','city','province','matter_type','status','conflict_checked','retainer_amount','retainer_balance','hourly_rate','source','referred_by','notes'];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f}=$${i++}`); vals.push(body[f]); }
    }
    if (!sets.length) return Response.json({ error: 'No fields' }, { status: 400 });
    vals.push(params.id);
    const r = await client.query(`UPDATE legal_client SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals);
    return Response.json({ client: r.rows[0] });
  } finally {
    client.release();
  }
}
