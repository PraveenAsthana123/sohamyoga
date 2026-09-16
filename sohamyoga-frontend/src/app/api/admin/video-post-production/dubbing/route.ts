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
    const result = await client.query('SELECT * FROM pp_dubbing_jobs ORDER BY created_at DESC');
    return Response.json({ dubbing_jobs: result.rows });
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
    const { project_name, source_language, target_language, voice_style = 'natural', estimated_minutes = 0 } = body;
    if (!project_name || !source_language || !target_language) {
      return Response.json({ error: 'project_name, source_language, and target_language are required' }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO pp_dubbing_jobs (project_name, source_language, target_language, voice_style, estimated_minutes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_name, source_language, target_language, voice_style, estimated_minutes]
    );
    return Response.json({ dubbing_job: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
