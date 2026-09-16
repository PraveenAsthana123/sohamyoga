import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WORKFLOW = ['quote', 'artwork_review', 'pre_press', 'printing', 'finishing', 'quality_check', 'ready_for_pickup', 'shipped', 'delivered'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT status FROM ps_order WHERE id = $1`, [params.id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const current = rows[0].status;
    const idx = WORKFLOW.indexOf(current);
    if (idx < 0 || idx >= WORKFLOW.length - 1) {
      return NextResponse.json({ error: 'Cannot advance from current status' }, { status: 400 });
    }
    const next = WORKFLOW[idx + 1];
    const { rows: updated } = await client.query(`UPDATE ps_order SET status = $2 WHERE id = $1 RETURNING *`, [params.id, next]);
    return NextResponse.json(updated[0]);
  } finally {
    client.release();
  }
}
