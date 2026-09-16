import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE it_ticket SET status='resolved', resolved_at=NOW(), resolution_notes=COALESCE($2,resolution_notes), time_spent_minutes=COALESCE($3,time_spent_minutes), first_response_at=COALESCE(first_response_at, created_at) WHERE id=$1 RETURNING *`,
      [params.id, body.resolution_notes, body.time_spent_minutes]
    );
    if (!rows.length) return Response.json({ error: 'Ticket not found.' }, { status: 404 });
    return Response.json({ ticket: rows[0] });
  } finally {
    client.release();
  }
}
