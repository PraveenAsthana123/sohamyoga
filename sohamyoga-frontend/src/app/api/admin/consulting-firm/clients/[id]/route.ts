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
    const id = parseInt(params.id);
    const [clientRow, engagements] = await Promise.all([
      client.query(`SELECT * FROM cf_client WHERE id=$1`, [id]),
      client.query(`SELECT * FROM cf_engagement WHERE client_id=$1 ORDER BY created_at DESC`, [id]),
    ]);
    if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ ...clientRow.rows[0], engagements: engagements.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const allowed = ['status','total_fees','relationship_manager','notes','contact_phone'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
    const sets = fields.map((f, i) => `${f}=$${i + 2}`).join(', ');
    const { rows } = await client.query(`UPDATE cf_client SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...fields.map(f => body[f])]);
    return Response.json(rows[0]);
  } finally {
    client.release();
  }
}
