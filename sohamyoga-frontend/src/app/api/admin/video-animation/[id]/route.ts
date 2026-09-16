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
    const project = await client.query('SELECT * FROM anim_projects WHERE id = $1', [id]);
    if (project.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });

    const assets = await client.query('SELECT * FROM anim_assets WHERE project_id = $1 ORDER BY created_at DESC', [id]);
    return Response.json({ project: project.rows[0], assets: assets.rows });
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
    const { status, brief, script, complexity, estimated_hours, style } = body;

    const result = await client.query(
      `UPDATE anim_projects
       SET status = COALESCE($1, status),
           brief = COALESCE($2, brief),
           script = COALESCE($3, script),
           complexity = COALESCE($4, complexity),
           estimated_hours = COALESCE($5, estimated_hours),
           style = COALESCE($6, style)
       WHERE id = $7 RETURNING *`,
      [status, brief, script, complexity, estimated_hours, style, id]
    );
    if (result.rowCount === 0) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ project: result.rows[0] });
  } finally {
    client.release();
  }
}
