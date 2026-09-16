import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_ADVANCE: Record<string, string> = {
  pending: 'draft',
  draft: 'internal_review',
  internal_review: 'client_review',
  client_review: 'approved',
  approved: 'issued_for_construction',
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Get current status
    const { rows: cur } = await client.query(`SELECT status FROM engineering_deliverable WHERE id=$1`, [params.id]);
    if (!cur.length) return Response.json({ error: 'Deliverable not found.' }, { status: 404 });
    const nextStatus = body.status ?? STATUS_ADVANCE[cur[0].status] ?? cur[0].status;
    const { rows } = await client.query(
      `UPDATE engineering_deliverable SET status=$2, submitted_date=COALESCE($3, CASE WHEN $2='client_review' THEN CURRENT_DATE ELSE submitted_date END), notes=COALESCE($4, notes) WHERE id=$1 RETURNING *`,
      [params.id, nextStatus, body.submitted_date, body.notes]
    );
    return Response.json({ deliverable: rows[0] });
  } finally {
    client.release();
  }
}
