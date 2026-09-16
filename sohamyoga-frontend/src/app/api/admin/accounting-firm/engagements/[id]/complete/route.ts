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
      `UPDATE accounting_engagement SET status='completed', completed_date=COALESCE($2, CURRENT_DATE), notes=COALESCE($3, notes) WHERE id=$1 RETURNING *`,
      [params.id, body.completed_date, body.notes]
    );
    if (!rows.length) return Response.json({ error: 'Engagement not found.' }, { status: 404 });
    return Response.json({ engagement: rows[0] });
  } finally {
    client.release();
  }
}
