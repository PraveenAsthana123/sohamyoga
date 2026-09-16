import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { invoice_amount } = body as { invoice_amount: number };
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Mark unbilled time entries as billed
      await client.query(`UPDATE arch_time_entry SET billed = true WHERE project_id = $1 AND billable = true AND billed = false`, [params.id]);
      // Update project billing amounts
      const { rows } = await client.query(
        `UPDATE arch_project
         SET billed_to_date = billed_to_date + $1,
             outstanding_balance = GREATEST(outstanding_balance - $1, 0)
         WHERE id = $2 RETURNING *`,
        [invoice_amount ?? 0, params.id]
      );
      return Response.json({ ok: true, project: rows[0], invoice_amount });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
