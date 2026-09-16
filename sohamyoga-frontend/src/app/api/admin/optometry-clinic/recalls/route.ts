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
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const { rows } = await client.query(
      `SELECT id, first_name, last_name, phone, email, last_exam_date, next_recall_date, recall_interval_months,
              insurance_provider, city,
              CASE WHEN next_recall_date < NOW() THEN 'overdue'
                   WHEN next_recall_date <= NOW() + ($1 || ' days')::INTERVAL THEN 'due'
                   ELSE 'ok' END AS recall_status
       FROM opt_patient
       WHERE next_recall_date <= NOW() + ($1 || ' days')::INTERVAL
       ORDER BY next_recall_date ASC LIMIT 200`,
      [days]
    );
    return Response.json(rows);
  } finally { client.release(); }
}
