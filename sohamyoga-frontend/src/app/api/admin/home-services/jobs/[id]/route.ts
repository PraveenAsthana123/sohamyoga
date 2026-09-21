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
    const row = await client.query(
      `SELECT j.*, c.first_name, c.last_name, c.address, c.phone, c.gate_code, c.pet_info, c.alarm_code, c.service_notes
       FROM hs_job j JOIN hs_customer c ON c.id = j.customer_id WHERE j.id = $1`,
      [params.id]
    );
    if (!row.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json();
    const row = await client.query(
      `UPDATE hs_job SET
        status=COALESCE($1,status),
        payment_status=COALESCE($2,payment_status),
        customer_rating=COALESCE($3,customer_rating),
        customer_feedback=COALESCE($4,customer_feedback),
        tip_amount=COALESCE($5,tip_amount),
        checklist_completed=COALESCE($6,checklist_completed),
        notes=COALESCE($7,notes)
       WHERE id=$8 RETURNING *`,
      [b.status, b.payment_status, b.customer_rating, b.customer_feedback, b.tip_amount, b.checklist_completed, b.notes, params.id]
    );
    return Response.json(row.rows[0]);
  } finally { client.release(); }
}
