import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const { output_notes } = body;

    const result = await client.query(
      `UPDATE pp_jobs SET status = 'completed', completed_at = NOW(), output_notes = COALESCE($1, output_notes)
       WHERE id = $2 RETURNING *`,
      [output_notes, id]
    );
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ job: result.rows[0] });
  } finally {
    client.release();
  }
}
