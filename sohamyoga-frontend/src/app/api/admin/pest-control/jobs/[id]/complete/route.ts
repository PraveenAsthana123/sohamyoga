import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await client.query(
      `UPDATE pc_jobs
       SET status = 'completed',
           completed_date = $1,
           treatment_method = COALESCE($2, treatment_method),
           products_used   = COALESCE($3, products_used),
           infestation_level = COALESCE($4, infestation_level),
           labour_hours    = COALESCE($5, labour_hours),
           total_amount    = COALESCE($6, total_amount),
           follow_up_required = COALESCE($7, follow_up_required),
           follow_up_date  = COALESCE($8, follow_up_date),
           notes           = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [
        b.completed_date ?? today,
        b.treatment_method ?? null,
        b.products_used ? JSON.stringify(b.products_used) : null,
        b.infestation_level ?? null,
        b.labour_hours ?? null,
        b.total_amount ?? null,
        b.follow_up_required ?? null,
        b.follow_up_date ?? null,
        b.notes ?? null,
        params.id,
      ]
    );
    if (!rows.length) return Response.json({ error: 'Job not found.' }, { status: 404 });
    return Response.json({ job: rows[0] });
  } finally {
    client.release();
  }
}
