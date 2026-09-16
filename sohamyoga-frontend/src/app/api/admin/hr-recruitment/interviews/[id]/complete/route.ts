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
    const body = await req.json();
    const { feedback, rating, recommendation } = body;

    const r = await client.query(`
      UPDATE hr_interview SET status='completed', feedback=$1, rating=$2, recommendation=$3
      WHERE id=$4 RETURNING *
    `, [feedback, rating, recommendation, params.id]);

    if (!r.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ interview: r.rows[0] });
  } finally {
    client.release();
  }
}
