import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const { metric_id, value, notes, source, recorded_at } = body;

  if (!metric_id || value === undefined) {
    return Response.json({ error: 'metric_id and value are required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO metric_snapshot (metric_id, value, notes, source, recorded_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [metric_id, value, notes ?? null, source ?? 'manual', recorded_at ?? new Date().toISOString().slice(0,10)],
    );
    return Response.json({ snapshot: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
