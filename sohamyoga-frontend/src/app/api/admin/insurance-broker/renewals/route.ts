import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT p.id, p.policy_type, p.insurer, p.policy_number,
        p.annual_premium, p.monthly_premium, p.expiry_date, p.renewal_reminder_sent,
        p.broker_commission_pct, p.status,
        (p.expiry_date - CURRENT_DATE) AS days_to_expiry,
        ic.id AS client_id, ic.name AS client_name,
        ic.phone AS client_phone, ic.email AS client_email
      FROM insurance_policy p
      JOIN insurance_client ic ON ic.id = p.client_id
      WHERE p.status = 'active'
        AND p.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      ORDER BY p.expiry_date ASC
    `);

    const bucket30 = result.rows.filter(r => Number(r.days_to_expiry) <= 30);
    const bucket60 = result.rows.filter(r => Number(r.days_to_expiry) > 30 && Number(r.days_to_expiry) <= 60);
    const bucket90 = result.rows.filter(r => Number(r.days_to_expiry) > 60 && Number(r.days_to_expiry) <= 90);

    return Response.json({
      expiring_30: bucket30,
      expiring_60: bucket60,
      expiring_90: bucket90,
      total: result.rows.length,
    });
  } finally {
    client.release();
  }
}
