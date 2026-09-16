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
    const result = await client.query('SELECT * FROM pp_clip_extractions ORDER BY created_at DESC');
    return Response.json({ clips: result.rows });
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
    const { project_name, source_file, clips = [], purpose } = body;
    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO pp_clip_extractions (project_name, source_file, clips, total_clips, purpose)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_name, source_file, JSON.stringify(clips), clips.length, purpose]
    );
    return Response.json({ clip_extraction: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
