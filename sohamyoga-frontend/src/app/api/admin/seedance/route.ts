import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS seedance_jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      model_version TEXT DEFAULT 'seedance-1-pro',
      resolution TEXT DEFAULT '720p',
      duration_seconds INTEGER DEFAULT 5,
      motion_level TEXT DEFAULT 'Medium',
      seed INTEGER,
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
      task_id TEXT,
      output_url TEXT,
      error_message TEXT,
      inference_time_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS seedance_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ items: [], api_key_set: false });
  await ensureTables();
  const pool = getPool(); const client = await pool.connect();
  try {
    const [jobs, settings] = await Promise.all([
      client.query('SELECT * FROM seedance_jobs ORDER BY created_at DESC LIMIT 200'),
      client.query("SELECT value FROM seedance_settings WHERE key='api_key'"),
    ]);
    return Response.json({ items: jobs.rows, api_key_set: settings.rows.length > 0 });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const jobNumber = `SD-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const keyRow = await client.query("SELECT value FROM seedance_settings WHERE key='api_key'");
    const apiKey = keyRow.rows[0]?.value;
    let status = 'queued';
    let taskId: string | null = null;
    let errorMessage: string | null = null;
    if (apiKey) {
      try {
        // Seedance via Volcano Engine API
        const volcRes = await fetch('https://visual.volcengineapi.com/api/v1/video_generation', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: body.model_version ?? 'seedance-1-pro', prompt: body.prompt, negative_prompt: body.negative_prompt ?? '', resolution: body.resolution ?? '720p', duration: body.duration_seconds ?? 5, motion_level: (body.motion_level as string ?? 'Medium').toLowerCase(), seed: body.seed ?? null }),
          signal: AbortSignal.timeout(30000),
        });
        if (volcRes.ok) { const d = await volcRes.json(); taskId = d.task_id ?? null; status = 'processing'; }
        else { errorMessage = `API error: ${volcRes.status}`; status = 'failed'; }
      } catch (e: unknown) { errorMessage = e instanceof Error ? e.message : 'Request failed'; status = 'failed'; }
    }
    const r = await client.query(
      `INSERT INTO seedance_jobs (job_number,prompt,negative_prompt,model_version,resolution,duration_seconds,motion_level,seed,status,task_id,error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [jobNumber, body.prompt, body.negative_prompt ?? null, body.model_version ?? 'seedance-1-pro',
       body.resolution ?? '720p', body.duration_seconds ?? 5, body.motion_level ?? 'Medium',
       body.seed ?? null, status, taskId, errorMessage]
    );
    return Response.json({ job: r.rows[0], message: status === 'processing' ? `Job ${jobNumber} submitted — task_id: ${taskId}` : status === 'queued' ? `Job ${jobNumber} queued (add API key to execute)` : errorMessage });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool(); const client = await pool.connect();
  try {
    if (body.action === 'set_api_key') {
      await client.query(`INSERT INTO seedance_settings (key,value) VALUES ('api_key',$1) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`, [body.api_key]);
      return Response.json({ ok: true });
    }
    const r = await client.query(`UPDATE seedance_jobs SET status=$1,output_url=$2,completed_at=NOW() WHERE id=$3 RETURNING *`, [body.status ?? 'completed', body.output_url ?? null, body.id]);
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
