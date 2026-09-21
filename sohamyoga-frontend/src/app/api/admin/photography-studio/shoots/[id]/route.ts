import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const shoot = await client.query(
      `SELECT s.*, c.first_name, c.last_name, c.email, c.phone FROM photo_shoot s JOIN photo_client c ON c.id = s.client_id WHERE s.id = $1`,
      [params.id]
    );
    if (!shoot.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const expenses = await client.query(`SELECT * FROM photo_expense WHERE shoot_id = $1 ORDER BY created_at DESC`, [params.id]);
    return Response.json({ ...shoot.rows[0], expenses: expenses.rows });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE photo_shoot SET
        status=COALESCE($1,status), photographer=COALESCE($2,photographer),
        deposit_paid=COALESCE($3,deposit_paid), balance_paid=COALESCE($4,balance_paid),
        contract_signed=COALESCE($5,contract_signed), gallery_url=COALESCE($6,gallery_url),
        num_edited_photos=COALESCE($7,num_edited_photos), notes=COALESCE($8,notes)
       WHERE id=$9 RETURNING *`,
      [b.status, b.photographer, b.deposit_paid, b.balance_paid, b.contract_signed, b.gallery_url, b.num_edited_photos, b.notes, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`UPDATE photo_shoot SET status='archived' WHERE id=$1`, [params.id]);
    return Response.json({ success: true });
  } finally { client.release(); }
}
