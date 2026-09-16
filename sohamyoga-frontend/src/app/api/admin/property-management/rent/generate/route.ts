import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { month } = body; // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return Response.json({ error: 'month is required in YYYY-MM format' }, { status: 400 });
    }
    const [year, mon] = month.split('-').map(Number);
    const dueDate = `${month}-01`;
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows: tenants } = await client.query(`SELECT id, property_id, monthly_rent FROM pm_tenant WHERE status='active'`);
      let created = 0;
      let skipped = 0;
      for (const t of tenants) {
        const existing = await client.query(`SELECT id FROM pm_rent_payment WHERE tenant_id=$1 AND DATE_TRUNC('month',due_date)=DATE_TRUNC('month',$2::date)`, [t.id, dueDate]);
        if (existing.rows.length) { skipped++; continue; }
        await client.query(`INSERT INTO pm_rent_payment (tenant_id, property_id, amount, due_date, status) VALUES ($1,$2,$3,$4,'pending')`, [t.id, t.property_id, t.monthly_rent, dueDate]);
        created++;
      }
      return Response.json({ created, skipped, month, message: `Generated ${created} rent records for ${month}` });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
