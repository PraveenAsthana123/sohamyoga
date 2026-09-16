import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project_id');
  const pool = getPool();
  const client = await pool.connect();
  try {
    const cond = projectId ? 'WHERE t.project_id=$1' : '';
    const vals = projectId ? [projectId] : [];
    const { rows } = await client.query(`SELECT t.*, c.name AS client_name, p.title AS project_title FROM engineering_time_entry t LEFT JOIN engineering_client c ON c.id=t.client_id LEFT JOIN engineering_project p ON p.id=t.project_id ${cond} ORDER BY t.date DESC`, vals);
    return Response.json({ entries: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.project_id || !body?.description || body?.hours == null) return Response.json({ error: 'project_id, description, hours are required.' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Update actual_hours on project
    await client.query(`UPDATE engineering_project SET actual_hours = actual_hours + $1 WHERE id=$2`, [body.hours, body.project_id]);
    const { rows } = await client.query(
      `INSERT INTO engineering_time_entry (project_id, client_id, date, staff_name, discipline, description, hours, rate, billable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.project_id, body.client_id, body.date, body.staff_name, body.discipline, body.description, body.hours, body.rate, body.billable ?? true]
    );
    return Response.json({ entry: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
