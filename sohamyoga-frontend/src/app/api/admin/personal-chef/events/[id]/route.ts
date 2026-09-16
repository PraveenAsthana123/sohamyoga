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
      const [eventRow, shoppingList] = await Promise.all([
        client.query(`
          SELECT e.*, c.first_name, c.last_name, c.email, c.phone, c.dietary_restrictions, c.food_allergies, c.cuisine_preferences
          FROM chef_event e LEFT JOIN chef_client c ON c.id=e.client_id WHERE e.id=$1
        `, [params.id]),
        client.query(`SELECT * FROM chef_shopping_list WHERE event_id=$1 ORDER BY purchased, ingredient`, [params.id]),
      ]);
      if (!eventRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ ...eventRow.rows[0], shopping_list: shoppingList.rows });
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
      const validStatuses = ['inquiry','confirmed','shopping','prep','service','completed','cancelled'];
      if (body.status && !validStatuses.includes(body.status)) {
        return Response.json({ error: 'Invalid status' }, { status: 400 });
      }
      const fields = Object.keys(body).filter(k => k !== 'id');
      const sets = fields.map((k, i) => `${k}=$${i + 2}`).join(',');
      const vals = fields.map(k => body[k]);
      const { rows } = await client.query(`UPDATE chef_event SET ${sets} WHERE id=$1 RETURNING *`, [params.id, ...vals]);
      return Response.json(rows[0]);
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query(`UPDATE chef_event SET status='cancelled' WHERE id=$1`, [params.id]);
      return Response.json({ success: true });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
