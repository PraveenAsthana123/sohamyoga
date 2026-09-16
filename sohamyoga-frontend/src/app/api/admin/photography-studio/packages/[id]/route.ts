import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE photo_package SET name=COALESCE($1,name), price=COALESCE($2,price), description=COALESCE($3,description), is_active=COALESCE($4,is_active), includes_edited_photos=COALESCE($5,includes_edited_photos) WHERE id=$6 RETURNING *`,
      [b.name, b.price, b.description, b.is_active, b.includes_edited_photos, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE photo_package SET is_active = false WHERE id = $1`, [params.id]);
    return Response.json({ success: true });
  } finally { client.release(); }
}
