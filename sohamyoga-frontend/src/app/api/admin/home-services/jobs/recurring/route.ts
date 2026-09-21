import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const rows = await client.query(
      `SELECT j.*, c.first_name, c.last_name, c.address FROM hs_job j JOIN hs_customer c ON c.id = j.customer_id WHERE j.recurrence != 'one_time' ORDER BY j.scheduled_at DESC LIMIT 200`
    );
    return Response.json(rows.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  try { await requireAdmin(req); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { job_id } = await req.json();
    const job = await client.query(`SELECT * FROM hs_job WHERE id = $1`, [job_id]);
    if (!job.rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const src = job.rows[0];
    const lastDate = new Date(src.scheduled_at);
    const intervalDays: Record<string, number> = { weekly: 7, bi_weekly: 14, monthly: 30 };
    const days = intervalDays[src.recurrence] ?? 7;
    lastDate.setDate(lastDate.getDate() + days);

    const newJob = await client.query(
      `INSERT INTO hs_job (customer_id,service_type,scheduled_at,duration_hours,assigned_team,recurrence,price,payment_method,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [src.customer_id, src.service_type, lastDate.toISOString(), src.duration_hours, src.assigned_team, src.recurrence, src.price, src.payment_method, src.notes]
    );
    return Response.json(newJob.rows[0], { status: 201 });
  } finally { client.release(); }
}
