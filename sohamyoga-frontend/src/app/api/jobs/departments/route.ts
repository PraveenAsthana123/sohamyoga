import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT department
      FROM job_posting
      WHERE department IS NOT NULL
      ORDER BY department
    `).catch(() => ({ rows: [] as Array<{ department: string }> }));

    return Response.json({ departments: result.rows.map((r) => r.department) });
  } finally {
    client.release();
  }
}
