import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [summary, bySupplier, overdue] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) AS total_items,
            COALESCE(SUM(unit_retail * quantity),0) AS total_value,
            COALESCE(SUM(CASE WHEN status IN ('ordered','on_backorder') THEN unit_retail * quantity ELSE 0 END),0) AS outstanding_value,
            COALESCE(SUM(CASE WHEN status IN ('received','installed') THEN unit_retail * quantity ELSE 0 END),0) AS received_value
          FROM id_item WHERE project_id = $1
        `, [params.id]),
        client.query(`
          SELECT supplier, COUNT(*) AS item_count, SUM(unit_retail * quantity) AS total_value,
                 SUM(CASE WHEN status IN ('ordered','on_backorder') THEN unit_retail * quantity ELSE 0 END) AS outstanding
          FROM id_item WHERE project_id = $1 AND supplier IS NOT NULL
          GROUP BY supplier ORDER BY total_value DESC
        `, [params.id]),
        client.query(`
          SELECT * FROM id_item WHERE project_id = $1 AND status IN ('ordered','on_backorder')
          AND expected_delivery IS NOT NULL AND expected_delivery < CURRENT_DATE
          ORDER BY expected_delivery
        `, [params.id]),
      ]);
      return Response.json({ summary: summary.rows[0], by_supplier: bySupplier.rows, overdue_items: overdue.rows });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
