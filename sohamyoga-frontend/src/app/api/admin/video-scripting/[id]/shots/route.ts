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
    const scriptRow = await client.query('SELECT project_name FROM vs_scripts WHERE id = $1', [id]);
    if (scriptRow.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });

    const shots = await client.query(
      'SELECT * FROM vs_shot_plans WHERE project_name = $1 ORDER BY created_at DESC',
      [scriptRow.rows[0].project_name]
    );
    return Response.json({ shots: shots.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const scriptRow = await client.query('SELECT project_name FROM vs_scripts WHERE id = $1', [id]);
    if (scriptRow.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const { shots = [], estimated_hours = 0 } = body;

    const result = await client.query(
      `INSERT INTO vs_shot_plans (project_name, shots, total_shots, estimated_hours)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [scriptRow.rows[0].project_name, JSON.stringify(shots), shots.length, estimated_hours]
    );
    return Response.json({ shot_plan: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
