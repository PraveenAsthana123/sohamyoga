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
    await client.query(`CREATE TABLE IF NOT EXISTS vtt_jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      source_type TEXT DEFAULT 'url' CHECK (source_type IN ('url','upload')),
      source_url TEXT,
      source_filename TEXT,
      language TEXT DEFAULT 'Auto-detect',
      output_format TEXT DEFAULT 'Plain Text',
      include_timestamps BOOLEAN DEFAULT true,
      include_speaker_labels BOOLEAN DEFAULT false,
      model_used TEXT DEFAULT 'whisper-large-v3',
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
      transcript_preview TEXT,
      full_transcript_path TEXT,
      word_count INTEGER,
      duration_seconds INTEGER,
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
    const r = await client.query('SELECT * FROM vtt_jobs ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const jobNumber = `VTT-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO vtt_jobs (job_number, source_type, source_url, source_filename, language, output_format, include_timestamps, include_speaker_labels, model_used, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued') RETURNING *`,
      [jobNumber, body.source_type ?? 'url', body.source_url ?? null, body.source_filename ?? null,
       body.language ?? 'Auto-detect', body.output_format ?? 'Plain Text',
       body.include_timestamps ?? true, body.include_speaker_labels ?? false,
       body.model_used ?? 'whisper-large-v3']
    );
    return Response.json({ job: r.rows[0], message: `Job ${jobNumber} queued for transcription` });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE vtt_jobs SET status=$1, transcript_preview=$2, word_count=$3, duration_seconds=$4, completed_at=NOW() WHERE id=$5 RETURNING *`,
      [body.status ?? 'completed', body.transcript_preview ?? null,
       body.word_count ?? null, body.duration_seconds ?? null, body.id]
    );
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
