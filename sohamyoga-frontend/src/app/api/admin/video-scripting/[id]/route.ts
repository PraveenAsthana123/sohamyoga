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
    const script = await client.query('SELECT * FROM vs_scripts WHERE id = $1', [id]);
    if (script.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });

    const storyboards = await client.query('SELECT * FROM vs_storyboards WHERE script_id = $1 ORDER BY created_at DESC', [id]);
    const shots = await client.query('SELECT * FROM vs_shot_plans WHERE project_name = $1 ORDER BY created_at DESC', [script.rows[0].project_name]);

    return Response.json({ script: script.rows[0], storyboards: storyboards.rows, shots: shots.rows });
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
    const { script_text, status, key_message, target_audience, duration_seconds, video_type } = body;

    const result = await client.query(
      `UPDATE vs_scripts
       SET script_text = COALESCE($1, script_text),
           status = COALESCE($2, status),
           key_message = COALESCE($3, key_message),
           target_audience = COALESCE($4, target_audience),
           duration_seconds = COALESCE($5, duration_seconds),
           video_type = COALESCE($6, video_type),
           version = version + 1
       WHERE id = $7 RETURNING *`,
      [script_text, status, key_message, target_audience, duration_seconds, video_type, id]
    );

    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ script: result.rows[0] });
  } finally {
    client.release();
  }
}
