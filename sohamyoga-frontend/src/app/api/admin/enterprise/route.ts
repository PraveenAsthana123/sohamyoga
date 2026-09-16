export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;

  const client = await pool.connect();
  try {
    const [tenants, franchises, corporate, audits] = await Promise.all([
      client.query(`
        SELECT t.id, t.name, t.slug, t.status, t.plan, t.created_at,
          COUNT(DISTINCT tmc.capability_key) as capability_count
        FROM tenant t
        LEFT JOIN tenant_marketing_capability tmc ON tmc.tenant_id = t.id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `),
      client.query(`SELECT * FROM franchise_agreement ORDER BY created_at DESC LIMIT 50`),
      client.query(`
        SELECT cwp.*, v.program_count, v.active_employees
        FROM corporate_wellness_program cwp
        LEFT JOIN v_corporate_program_stats v ON v.program_id = cwp.id
        ORDER BY cwp.created_at DESC LIMIT 50
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT * FROM enterprise_audit ORDER BY created_at DESC LIMIT 100
      `).catch(() => ({ rows: [] })),
    ]);

    const summary = {
      totalTenants: tenants.rows.length,
      activeTenants: tenants.rows.filter(t => t.status === 'active').length,
      franchiseAgreements: franchises.rows.length,
      corporatePrograms: corporate.rows.length,
    };

    return Response.json({
      summary,
      tenants: tenants.rows,
      franchises: franchises.rows,
      corporatePrograms: corporate.rows,
      audits: audits.rows,
    });
  } finally {
    client.release();
  }
}
