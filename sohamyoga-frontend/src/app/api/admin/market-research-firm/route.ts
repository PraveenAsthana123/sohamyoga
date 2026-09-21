import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS research_study (
        id SERIAL PRIMARY KEY, study_name TEXT NOT NULL, client_name TEXT,
        methodology TEXT DEFAULT 'survey', sample_size INT DEFAULT 100,
        research_objectives TEXT, target_audience TEXT,
        start_date DATE DEFAULT CURRENT_DATE, end_date DATE,
        lead_researcher TEXT, budget NUMERIC(10,2),
        status TEXT DEFAULT 'planning',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS research_finding (
        id SERIAL PRIMARY KEY, study_id INT REFERENCES research_study(id) ON DELETE CASCADE,
        study_name TEXT, insight TEXT NOT NULL,
        confidence TEXT DEFAULT 'medium',
        data_source TEXT, tags TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ studies: [], findings: [] });
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [studies, findings] = await Promise.all([
      client.query('SELECT * FROM research_study ORDER BY created_at DESC LIMIT 100'),
      client.query('SELECT * FROM research_finding ORDER BY created_at DESC LIMIT 200'),
    ]);
    return Response.json({ studies: studies.rows, findings: findings.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'finding') {
      const r = await client.query(
        'INSERT INTO research_finding (study_name, insight, confidence) VALUES ($1,$2,$3) RETURNING *',
        [body.study_name ?? '', body.insight ?? '', body.confidence ?? 'medium']
      );
      return Response.json(r.rows[0]);
    }
    const r = await client.query(
      'INSERT INTO research_study (study_name, client_name, methodology, sample_size) VALUES ($1,$2,$3,$4) RETURNING *',
      [body.study_name ?? '', body.client_name ?? '', body.methodology ?? 'survey', body.sample_size ?? 100]
    );
    return Response.json(r.rows[0]);
  } finally { client.release(); }
}
