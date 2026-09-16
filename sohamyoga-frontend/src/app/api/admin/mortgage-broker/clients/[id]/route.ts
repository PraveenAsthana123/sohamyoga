import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [clientRow, apps] = await Promise.all([
      client.query(`SELECT * FROM mortgage_client WHERE id = $1`, [id]),
      client.query(`
        SELECT a.*, json_agg(ls ORDER BY ls.submitted_at DESC) FILTER (WHERE ls.id IS NOT NULL) AS submissions
        FROM mortgage_application a
        LEFT JOIN mortgage_lender_submission ls ON ls.application_id = a.id
        WHERE a.client_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC
      `, [id]),
    ]);
    if (!clientRow.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ client: clientRow.rows[0], applications: apps.rows });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const allowed = ['name','email','phone','address','city','province','date_of_birth','sin_last4',
    'employment_type','annual_income','co_applicant_income','credit_score','credit_tier',
    'total_debt','monthly_obligations','status','source','broker_notes'];
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  for (const key of allowed) {
    if (key in b) { sets.push(`${key} = $${idx++}`); vals.push(b[key]); }
  }
  if (!sets.length) return Response.json({ error: 'No valid fields' }, { status: 400 });
  vals.push(id);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE mortgage_client SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ client: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM mortgage_client WHERE id = $1`, [id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
