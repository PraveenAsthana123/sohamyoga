import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [customers, contracts, jobsWeek, revMtd, chemicals, permits] = await Promise.all([
      client.query(`SELECT COUNT(*) AS cnt FROM pool_customers WHERE is_active = true`),
      client.query(`SELECT COUNT(*) AS cnt FROM pool_customers WHERE is_active = true AND contract_end >= NOW()`),
      client.query(`SELECT COUNT(*) AS cnt FROM pool_service_visits WHERE visit_date >= date_trunc('week', NOW()) AND visit_date < date_trunc('week', NOW()) + interval '7 days'`),
      client.query(`SELECT COALESCE(SUM(total_amount), 0) AS rev FROM pool_service_visits WHERE DATE_TRUNC('month', visit_date) = DATE_TRUNC('month', NOW()) AND status = 'completed'`),
      client.query(`SELECT COUNT(*) AS cnt FROM pool_chemicals WHERE quantity_on_hand <= reorder_threshold`),
      client.query(`SELECT COUNT(*) AS cnt FROM pool_equipment WHERE warranty_expiry IS NOT NULL AND warranty_expiry BETWEEN NOW() AND NOW() + interval '90 days'`),
    ]);

    return Response.json({
      total_customers: Number(customers.rows[0].cnt),
      active_service_contracts: Number(contracts.rows[0].cnt),
      jobs_this_week: Number(jobsWeek.rows[0].cnt),
      revenue_mtd: Number(revMtd.rows[0].rev),
      chemicals_low_stock: Number(chemicals.rows[0].cnt),
      permits_expiring_90d: Number(permits.rows[0].cnt),
    });
  } finally {
    client.release();
  }
}
