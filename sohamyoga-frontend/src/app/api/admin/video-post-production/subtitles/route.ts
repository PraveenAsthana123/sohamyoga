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
    const language = url.searchParams.get('language');

    let q = 'SELECT * FROM pp_subtitle_tracks WHERE 1=1';
    const vals: unknown[] = [];
    if (project) { vals.push(project); q += ` AND project_name = $${vals.length}`; }
    if (language) { vals.push(language); q += ` AND language = $${vals.length}`; }
    q += ' ORDER BY created_at DESC';

    const result = await client.query(q, vals);
    return Response.json({ subtitles: result.rows });
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
    const { project_name, language = 'en', format = 'SRT', content = '' } = body;
    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });

    const wordCount = content ? content.trim().split(/\s+/).length : 0;
    const result = await client.query(
      `INSERT INTO pp_subtitle_tracks (project_name, language, format, content, word_count)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_name, language, format, content, wordCount]
    );
    return Response.json({ subtitle: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
