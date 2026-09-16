import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const { searchParams } = new URL(req.url);
    const client_id = searchParams.get('client_id');
    const job_type = searchParams.get('job_type');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (client_id) { conditions.push(`j.client_id=$${vals.length + 1}`); vals.push(client_id); }
    if (job_type) { conditions.push(`j.job_type=$${vals.length + 1}`); vals.push(job_type); }
    if (date) { conditions.push(`j.scheduled_date=$${vals.length + 1}`); vals.push(date); }
    if (status) { conditions.push(`j.status=$${vals.length + 1}`); vals.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT j.*, c.farm_name, f.field_name FROM ag_jobs j
         JOIN ag_clients c ON c.id=j.client_id
         LEFT JOIN ag_fields f ON f.id=j.field_id
         ${where} ORDER BY j.scheduled_date DESC, j.created_at DESC LIMIT 100`, vals
      );
      return Response.json({ jobs: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag jobs GET error:', err);
    return Response.json({ error: 'Failed to fetch jobs.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    const body = await req.json().catch(() => null);
    if (!body?.client_id || !body?.job_type) return Response.json({ error: 'client_id and job_type are required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO ag_jobs (client_id, field_id, job_type, status, scheduled_date, operator_name, equipment_used, product_applied, rate_per_ac, acres_done, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.client_id, body.field_id, body.job_type, body.status ?? 'scheduled', body.scheduled_date, body.operator_name, body.equipment_used, body.product_applied, body.rate_per_ac, body.acres_done, body.notes]
      );
      return Response.json({ job: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('ag jobs POST error:', err);
    return Response.json({ error: 'Failed to create job.' }, { status: 500 });
  }
}
