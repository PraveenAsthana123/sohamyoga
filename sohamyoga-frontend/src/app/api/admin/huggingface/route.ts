import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS hf_jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      task_type TEXT NOT NULL,
      model_id TEXT NOT NULL,
      input_text TEXT,
      input_image_url TEXT,
      parameters JSONB,
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
      output_text TEXT,
      output_url TEXT,
      error_message TEXT,
      inference_time_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS hf_settings (
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
      client.query('SELECT * FROM hf_jobs ORDER BY created_at DESC LIMIT 200'),
      client.query("SELECT value FROM hf_settings WHERE key='api_key'"),
    ]);
    return Response.json({ items: jobs.rows, api_key_set: settings.rows.length > 0 });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const jobNumber = `HF-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    // Fetch API key
    const keyRow = await client.query("SELECT value FROM hf_settings WHERE key='api_key'");
    const apiKey = keyRow.rows[0]?.value;
    const start = Date.now();
    let outputText: string | null = null;
    let outputUrl: string | null = null;
    let status = 'completed';
    let errorMessage: string | null = null;
    if (apiKey) {
      try {
        const hfRes = await fetch(`https://api-inference.huggingface.co/models/${body.model_id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: body.input_text || body.input_image_url }),
          signal: AbortSignal.timeout(30000),
        });
        if (hfRes.ok) {
          const ct = hfRes.headers.get('content-type') || '';
          if (ct.includes('image')) { outputUrl = 'blob:generated'; }
          else { const d = await hfRes.json(); outputText = typeof d === 'string' ? d : JSON.stringify(d).slice(0, 2000); }
        } else { errorMessage = `HF API error: ${hfRes.status}`; status = 'failed'; }
      } catch (e: unknown) { errorMessage = e instanceof Error ? e.message : 'Inference failed'; status = 'failed'; }
    } else {
      outputText = 'API key not set — job logged without execution';
    }
    const inferenceTime = Date.now() - start;
    const r = await client.query(
      `INSERT INTO hf_jobs (job_number,task_type,model_id,input_text,input_image_url,status,output_text,output_url,error_message,inference_time_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [jobNumber, body.task_type, body.model_id, body.input_text ?? null, body.input_image_url ?? null,
       status, outputText, outputUrl, errorMessage, inferenceTime]
    );
    return Response.json({ job: r.rows[0], output_text: outputText, output_url: outputUrl, message: status === 'completed' ? 'Inference complete' : errorMessage });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  if (body.action === 'set_api_key') {
    const pool = getPool(); const client = await pool.connect();
    try {
      await client.query(`INSERT INTO hf_settings (key,value) VALUES ('api_key',$1) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`, [body.api_key]);
      return Response.json({ ok: true });
    } finally { client.release(); }
  }
  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
