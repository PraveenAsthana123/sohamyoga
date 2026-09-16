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
    const [customers, contracts, jobsToday, revMtd, emergencies, warranties] = await Promise.all([
      client.query(`SELECT COUNT(*) AS cnt FROM hvac_customers WHERE is_active = true`),
      client.query(`SELECT COUNT(*) AS cnt FROM hvac_customers WHERE is_active = true AND contract_end >= NOW()`),
      client.query(`SELECT COUNT(*) AS cnt FROM hvac_jobs WHERE scheduled_date = CURRENT_DATE`),
      client.query(`SELECT COALESCE(SUM(total_amount), 0) AS rev FROM hvac_jobs WHERE DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', NOW()) AND status = 'completed'`),
      client.query(`SELECT COUNT(*) AS cnt FROM hvac_jobs WHERE job_type = 'emergency' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`),
      client.query(`SELECT COUNT(*) AS cnt FROM hvac_equipment WHERE warranty_expiry IS NOT NULL AND warranty_expiry BETWEEN NOW() AND NOW() + interval '90 days'`),
    ]);
    return Response.json({
      total_customers: Number(customers.rows[0].cnt),
      active_maintenance_contracts: Number(contracts.rows[0].cnt),
      jobs_today: Number(jobsToday.rows[0].cnt),
      revenue_mtd: Number(revMtd.rows[0].rev),
      emergency_calls_mtd: Number(emergencies.rows[0].cnt),
      equipment_warranties_expiring_90d: Number(warranties.rows[0].cnt),
    });
  } finally {
    client.release();
  }
}
