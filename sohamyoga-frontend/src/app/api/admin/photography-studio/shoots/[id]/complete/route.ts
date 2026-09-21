import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await req.json();
    const shoot = await client.query(`SELECT * FROM photo_shoot WHERE id=$1 FOR UPDATE`, [params.id]);
    if (!shoot.rows[0]) { await client.query('ROLLBACK'); return Response.json({ error: 'Not found' }, { status: 404 }); }

    const updated = await client.query(
      `UPDATE photo_shoot SET status='completed', balance_paid=COALESCE($1,balance_paid) WHERE id=$2 RETURNING *`,
      [b.balance_paid, params.id]
    );

    if (shoot.rows[0].package_price) {
      await client.query(
        `UPDATE photo_client SET total_spent = total_spent + $1 WHERE id = $2`,
        [shoot.rows[0].package_price, shoot.rows[0].client_id]
      );
    }

    await client.query('COMMIT');
    return Response.json(updated.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return Response.json({ error: String(e) }, { status: 500 });
  } finally { client.release(); }
}
