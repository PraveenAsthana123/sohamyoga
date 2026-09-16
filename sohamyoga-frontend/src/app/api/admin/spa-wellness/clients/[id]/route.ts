import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [clientRow, history] = await Promise.all([
        client.query(`SELECT * FROM spa_client WHERE id=$1`, [params.id]),
        client.query(`
          SELECT a.*, s.name AS service_name, s.category, s.duration_minutes
          FROM spa_appointment a
          LEFT JOIN spa_service s ON s.id=a.service_id
          WHERE a.client_id=$1 ORDER BY a.scheduled_at DESC LIMIT 20
        `, [params.id]),
      ]);
      if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...clientRow.rows[0], appointment_history: history.rows });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const fields = Object.keys(body).filter(k => k !== 'id');
      if (!fields.length) return Response.json({ error: 'No fields' }, { status: 400 });
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(',');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE spa_client SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...vals]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
