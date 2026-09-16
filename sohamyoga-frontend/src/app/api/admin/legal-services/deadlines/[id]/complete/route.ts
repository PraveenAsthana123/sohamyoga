export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const r = await client.query(`
      UPDATE legal_deadline SET status = 'completed' WHERE id = $1 RETURNING *
    `, [params.id]);

    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ deadline: r.rows[0] });
  } finally {
    client.release();
  }
}
