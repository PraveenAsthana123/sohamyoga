import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const result = await client.query('SELECT * FROM pp_jobs WHERE id = $1', [id]);
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ job: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const { status, output_notes, assigned_to, settings } = body;

    const result = await client.query(
      `UPDATE pp_jobs
       SET status = COALESCE($1, status),
           output_notes = COALESCE($2, output_notes),
           assigned_to = COALESCE($3, assigned_to),
           settings = COALESCE($4, settings)
       WHERE id = $5 RETURNING *`,
      [status, output_notes, assigned_to, settings ? JSON.stringify(settings) : null, id]
    );
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ job: result.rows[0] });
  } finally {
    client.release();
  }
}
