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
    const result = await client.query('SELECT * FROM anim_repurpose_jobs ORDER BY created_at DESC');
    return Response.json({ repurpose_jobs: result.rows });
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
    const { source_video, target_formats = [] } = body;
    if (!source_video) return Response.json({ error: 'source_video is required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO anim_repurpose_jobs (source_video, target_formats, clips_count)
       VALUES ($1, $2, $3) RETURNING *`,
      [source_video, target_formats, target_formats.length]
    );
    return Response.json({ repurpose_job: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
