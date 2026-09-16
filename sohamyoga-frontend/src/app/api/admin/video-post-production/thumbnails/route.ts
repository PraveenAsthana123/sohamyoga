import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const url = new URL(req.url);
    const project = url.searchParams.get('project');
    const platform = url.searchParams.get('platform');

    let q = 'SELECT * FROM pp_thumbnail_assets WHERE 1=1';
    const vals: unknown[] = [];
    if (project) { vals.push(project); q += ` AND project_name = $${vals.length}`; }
    if (platform) { vals.push(platform); q += ` AND platform = $${vals.length}`; }
    q += ' ORDER BY ctr_score DESC, created_at DESC';

    const result = await client.query(q, vals);
    return Response.json({ thumbnails: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_name, style, prompt, platform = 'youtube', ctr_score = 0, notes } = body;
    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO pp_thumbnail_assets (project_name, style, prompt, platform, ctr_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [project_name, style, prompt, platform, ctr_score, notes]
    );
    return Response.json({ thumbnail: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
