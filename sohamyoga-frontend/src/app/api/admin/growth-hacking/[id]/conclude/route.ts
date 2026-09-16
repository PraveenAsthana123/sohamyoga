export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { actual_value, result, learnings } = body;
  if (!result) return Response.json({ error: 'result required (won/lost/inconclusive)' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE growth_experiments SET
        status='concluded', actual_value=$1, result=$2, learnings=$3, end_date=COALESCE(end_date, CURRENT_DATE)
       WHERE id=$4 RETURNING *`,
      [actual_value ?? null, result, learnings || null, id]
    );
    if (r.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(r.rows[0]);
  } finally {
    client.release();
  }
}
