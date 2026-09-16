export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM transcription_jobs WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const { rows: exports } = await client.query('SELECT * FROM transcription_exports WHERE job_id=$1 ORDER BY created_at DESC', [params.id]);
    const { rows: translations } = await client.query('SELECT * FROM transcription_translations WHERE job_id=$1 ORDER BY created_at DESC', [params.id]);
    return Response.json({ job: rows[0], exports, translations });
  } finally {
    client.release();
  }
}
