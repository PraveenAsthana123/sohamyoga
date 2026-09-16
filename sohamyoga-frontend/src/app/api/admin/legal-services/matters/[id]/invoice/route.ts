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
    // Get unbilled entries
    const entries = await client.query(`
      SELECT * FROM legal_time_entry WHERE matter_id=$1 AND billed=false
    `, [params.id]);

    if (entries.rows.length === 0) {
      return Response.json({ error: 'No unbilled time entries to invoice' }, { status: 400 });
    }

    const total = entries.rows.reduce((sum, e) => sum + (Number(e.hours) * Number(e.rate || 0)), 0);

    // Mark all as billed
    await client.query(`
      UPDATE legal_time_entry SET billed=true, invoiced_at=NOW() WHERE matter_id=$1 AND billed=false
    `, [params.id]);

    const matter = await client.query(`SELECT * FROM legal_matter WHERE id=$1`, [params.id]);

    return Response.json({
      invoice: {
        matter_id: params.id,
        matter_number: matter.rows[0]?.matter_number,
        matter_title: matter.rows[0]?.title,
        entries_count: entries.rows.length,
        total_amount: total.toFixed(2),
        invoiced_at: new Date().toISOString(),
        entries: entries.rows,
      }
    });
  } finally {
    client.release();
  }
}
