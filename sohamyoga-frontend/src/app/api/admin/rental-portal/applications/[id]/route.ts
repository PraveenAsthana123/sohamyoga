import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/rental-portal/applications/[id]
// Body may include: screening_status, credit_score, notes, references_provided
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const allowedFields = ['screening_status', 'credit_score', 'notes', 'references_provided'];
  const fields = Object.keys(body).filter((k) => allowedFields.includes(k));
  if (!fields.length) return Response.json({ error: 'No valid fields to update' }, { status: 400 });

  const sets   = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map((f) => body[f]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE rental_application SET ${sets} WHERE id = $1 RETURNING *`,
      [id, ...values],
    );
    if (!res.rows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({ application: res.rows[0] });
  } finally {
    client.release();
  }
}
