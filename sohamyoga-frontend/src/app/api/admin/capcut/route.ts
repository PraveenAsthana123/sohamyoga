import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS capcut_projects (
      id SERIAL PRIMARY KEY,
      project_number TEXT NOT NULL UNIQUE,
      project_name TEXT NOT NULL,
      template_id TEXT,
      template_name TEXT,
      script TEXT,
      aspect_ratio TEXT DEFAULT '9:16 (Reels/TikTok)',
      duration_estimate TEXT,
      background_music TEXT,
      voiceover_text TEXT,
      voiceover_voice TEXT DEFAULT 'en-US Female',
      subtitle_style TEXT DEFAULT 'TikTok Style',
      export_format TEXT DEFAULT 'MP4',
      export_resolution TEXT DEFAULT '1080p',
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft','queued','rendering','completed','failed')),
      output_url TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS capcut_settings (
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
    const [projects, settings] = await Promise.all([
      client.query('SELECT * FROM capcut_projects ORDER BY created_at DESC LIMIT 200'),
      client.query("SELECT value FROM capcut_settings WHERE key='api_key'"),
    ]);
    return Response.json({ items: projects.rows, api_key_set: settings.rows.length > 0 });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const projectNumber = `CC-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO capcut_projects (project_number,project_name,template_id,template_name,script,aspect_ratio,voiceover_text,voiceover_voice,subtitle_style,export_format,export_resolution,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft') RETURNING *`,
      [projectNumber, body.project_name, body.template_id ?? null, body.template_name ?? null,
       body.script ?? null, body.aspect_ratio ?? '9:16 (Reels/TikTok)',
       body.voiceover_text ?? null, body.voiceover_voice ?? 'en-US Female',
       body.subtitle_style ?? 'TikTok Style', body.export_format ?? 'MP4', body.export_resolution ?? '1080p']
    );
    return Response.json({ project: r.rows[0], message: `Project ${projectNumber} created` });
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
      await client.query(`INSERT INTO capcut_settings (key,value) VALUES ('api_key',$1) ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`, [body.api_key]);
      return Response.json({ ok: true });
    }
    const r = await client.query(`UPDATE capcut_projects SET status=$1,output_url=$2,completed_at=NOW() WHERE id=$3 RETURNING *`, [body.status ?? 'completed', body.output_url ?? null, body.id]);
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
