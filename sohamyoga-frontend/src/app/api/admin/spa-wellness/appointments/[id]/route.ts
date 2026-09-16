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
      const { rows } = await client.query(`
        SELECT a.*, c.first_name, c.last_name, c.phone, c.pressure_preference,
               c.health_conditions, c.medications, c.allergies, c.contraindications,
               s.name AS service_name, s.category, s.duration_minutes, s.price
        FROM spa_appointment a
        LEFT JOIN spa_client c ON c.id=a.client_id
        LEFT JOIN spa_service s ON s.id=a.service_id
        WHERE a.id=$1
      `, [params.id]);
      if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json(rows[0]);
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
      // workflow transitions: confirm, intake_complete, start (in_progress), cancel, no_show
      const validStatuses = ['scheduled','confirmed','intake_complete','in_progress','completed','cancelled','no_show'];
      if (body.status && !validStatuses.includes(body.status)) {
        return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(',');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE spa_appointment SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...vals]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
