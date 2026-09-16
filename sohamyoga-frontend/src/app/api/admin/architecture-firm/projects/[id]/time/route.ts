import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const billable = searchParams.get('billable');
  const aggregate = searchParams.get('aggregate');
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      if (aggregate === '1') {
        const { rows } = await client.query(`
          SELECT
            phase,
            staff_name,
            SUM(hours) AS total_hours,
            SUM(CASE WHEN billable THEN hours ELSE 0 END) AS billable_hours,
            SUM(CASE WHEN billed THEN hours ELSE 0 END) AS billed_hours
          FROM arch_time_entry WHERE project_id = $1
          GROUP BY phase, staff_name ORDER BY phase, staff_name
        `, [params.id]);
        return Response.json(rows);
      }
      const conditions = [`project_id = $1`];
      const vals: unknown[] = [params.id];
      if (billable === '1') { conditions.push(`billable = true`); }
      const { rows } = await client.query(`SELECT * FROM arch_time_entry WHERE ${conditions.join(' AND ')} ORDER BY entry_date DESC`, vals);
      return Response.json(rows);
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO arch_time_entry (project_id, staff_name, entry_date, phase, task_description, hours, hourly_rate, billable)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [params.id, body.staff_name, body.entry_date, body.phase, body.task_description,
         body.hours, body.hourly_rate, body.billable ?? true]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
