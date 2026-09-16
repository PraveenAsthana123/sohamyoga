import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Fetch current job to compute total_cost if not provided
      const { rows: existing } = await client.query(`SELECT * FROM ag_jobs WHERE id=$1`, [params.id]);
      if (!existing.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
      const job = existing[0];
      const acres_done = body.acres_done ?? job.acres_done ?? 0;
      const rate_per_ac = body.rate_per_ac ?? job.rate_per_ac ?? 0;
      const total_cost = body.total_cost ?? (Number(acres_done) * Number(rate_per_ac));
      const { rows } = await client.query(
        `UPDATE ag_jobs SET status='completed', completed_date=CURRENT_DATE, acres_done=$2, rate_per_ac=$3, total_cost=$4, notes=COALESCE($5,notes) WHERE id=$1 RETURNING *`,
        [params.id, acres_done, rate_per_ac, total_cost, body.notes]
      );
      return Response.json({ job: rows[0] });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag job complete POST error:', err);
    return Response.json({ error: 'Failed to complete job.' }, { status: 500 });
  }
}
