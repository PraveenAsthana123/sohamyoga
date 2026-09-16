import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { id } = params;
  if (!id || isNaN(Number(id))) return Response.json({ error: 'Valid id required.' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  // Check if this is an activate request (from the activate sub-route workaround)
  const newStatus = (body.status as string) ?? 'active';

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE promotion SET status = $1 WHERE id = $2 RETURNING *`,
      [newStatus, id]
    );
    if (!result.rowCount) return Response.json({ error: 'Promotion not found.' }, { status: 404 });
    return Response.json({ promotion: result.rows[0] });
  } finally {
    client.release();
  }
}
