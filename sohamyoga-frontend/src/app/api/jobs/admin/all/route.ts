import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, title, slug, department, location, employment_type, salary_range,
             summary, description, requirements, nice_to_have, is_active, sort_order,
             created_at, updated_at
      FROM job_posting
      ORDER BY sort_order ASC, created_at DESC
    `).catch(() => ({ rows: [] }));

    return Response.json({ jobs: result.rows });
  } finally {
    client.release();
  }
}
