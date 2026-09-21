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
    await client.query(`CREATE TABLE IF NOT EXISTS tti_jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      style TEXT DEFAULT 'Photorealistic',
      aspect_ratio TEXT DEFAULT '1:1 (Square)',
      num_images INTEGER DEFAULT 1,
      model_used TEXT DEFAULT 'stable-diffusion-xl',
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
      output_urls TEXT,
      seed INTEGER,
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
    const r = await client.query('SELECT * FROM tti_jobs ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const jobNumber = `TTI-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO tti_jobs (job_number, prompt, negative_prompt, style, aspect_ratio, num_images, model_used, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'queued') RETURNING *`,
      [jobNumber, body.prompt ?? '', body.negative_prompt ?? null, body.style ?? 'Photorealistic',
       body.aspect_ratio ?? '1:1 (Square)', body.num_images ?? 1, body.model_used ?? 'stable-diffusion-xl']
    );
    return Response.json({ job: r.rows[0], message: `Job ${jobNumber} queued — ${body.num_images ?? 1} image(s) will be generated` });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE tti_jobs SET status=$1, output_urls=$2, seed=$3, completed_at=NOW() WHERE id=$4 RETURNING *`,
      [body.status ?? 'completed', body.output_urls ?? null, body.seed ?? null, body.id]
    );
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
