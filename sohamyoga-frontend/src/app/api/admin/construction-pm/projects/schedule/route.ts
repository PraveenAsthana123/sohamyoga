import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(`
        SELECT p.id, p.project_name, p.project_number, p.project_manager,
               p.status, p.percent_complete, p.contract_value,
               p.original_start_date, p.actual_start_date,
               p.original_completion_date, p.revised_completion_date,
               c.company_name AS client_name,
               CASE WHEN p.revised_completion_date IS NOT NULL AND p.revised_completion_date > p.original_completion_date THEN true ELSE false END AS behind_schedule
        FROM cpm_project p
        LEFT JOIN cpm_client c ON c.id = p.client_id
        WHERE p.status IN ('active','pre_construction','awarded','substantial_completion')
        ORDER BY COALESCE(p.actual_start_date, p.original_start_date)
      `);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
