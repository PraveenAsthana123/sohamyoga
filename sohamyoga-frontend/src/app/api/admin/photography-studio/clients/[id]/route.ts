import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const c = await client.query(`SELECT * FROM photo_client WHERE id = $1`, [params.id]);
    if (!c.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const shoots = await client.query(`SELECT * FROM photo_shoot WHERE client_id = $1 ORDER BY scheduled_at DESC LIMIT 50`, [params.id]);
    return Response.json({ ...c.rows[0], shoots: shoots.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE photo_client SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name), email=COALESCE($3,email), phone=COALESCE($4,phone), company=COALESCE($5,company), client_type=COALESCE($6,client_type), notes=COALESCE($7,notes) WHERE id=$8 RETURNING *`,
      [b.first_name, b.last_name, b.email, b.phone, b.company, b.client_type, b.notes, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
