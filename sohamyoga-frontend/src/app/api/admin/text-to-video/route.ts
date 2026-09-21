import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS ttv_jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      style TEXT DEFAULT 'Cinematic',
      duration_seconds INTEGER DEFAULT 10,
      resolution TEXT DEFAULT '1080p',
      model_used TEXT DEFAULT 'runway-gen3',
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
      output_url TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );`);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ items: [] });
  await ensureTables();
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM ttv_jobs ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const jobNumber = `TTV-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO ttv_jobs (job_number, prompt, negative_prompt, style, duration_seconds, resolution, model_used, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued') RETURNING *`,
      [jobNumber, body.prompt ?? '', body.negative_prompt ?? null, body.style ?? 'Cinematic',
       body.duration_seconds ?? 10, body.resolution ?? '1080p', body.model_used ?? 'runway-gen3']
    );
    return Response.json({ job: r.rows[0], message: `Job ${jobNumber} queued for generation` });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE ttv_jobs SET status=$1, output_url=$2, completed_at=NOW() WHERE id=$3 RETURNING *`,
      [body.status ?? 'completed', body.output_url ?? null, body.id]
    );
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
