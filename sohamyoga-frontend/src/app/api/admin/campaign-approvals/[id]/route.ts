import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'client_reviewing', 'approved', 'rejected', 'revision_requested'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });

    const { status, reviewed_by, review_notes } = body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return Response.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      const isReviewed = ['approved', 'rejected', 'revision_requested'].includes(status);
      const { rows, rowCount } = await client.query(
        `UPDATE campaign_approvals
         SET status = $1,
             reviewed_by = COALESCE($2, reviewed_by),
             review_notes = COALESCE($3, review_notes),
             reviewed_at = CASE WHEN $4 THEN NOW() ELSE reviewed_at END
         WHERE id = $5
         RETURNING *`,
        [status, reviewed_by || null, review_notes || null, isReviewed, id]
      );
      if (!rowCount) return Response.json({ error: 'Approval not found.' }, { status: 404 });
      return Response.json({ approval: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('campaign-approvals [id] PATCH error:', err);
    return Response.json({ error: 'Failed to update campaign approval.' }, { status: 500 });
  }
}
