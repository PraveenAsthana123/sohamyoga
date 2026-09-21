import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  if (!databaseConfigured()) return;
  const pool = getPool(); const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS cline_tasks (
      id SERIAL PRIMARY KEY,
      task_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      task_type TEXT DEFAULT 'Code Generation',
      target_file TEXT,
      target_repo TEXT DEFAULT 'sohamyoga-frontend',
      model_used TEXT DEFAULT 'claude-opus-4-5',
      priority TEXT DEFAULT 'P2 - Medium',
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
      tokens_used INTEGER,
      cost_usd NUMERIC(10,6),
      output_summary TEXT,
      diff_preview TEXT,
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
    const r = await client.query('SELECT * FROM cline_tasks ORDER BY created_at DESC LIMIT 200');
    return Response.json({ items: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const taskNumber = `CLN-${Date.now()}`;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO cline_tasks (task_number,title,description,task_type,target_file,target_repo,model_used,priority,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [taskNumber, body.title, body.description, body.task_type ?? 'Code Generation',
       body.target_file ?? null, body.target_repo ?? 'sohamyoga-frontend',
       body.model_used ?? 'claude-opus-4-5', body.priority ?? 'P2 - Medium']
    );
    return Response.json({ task: r.rows[0], message: `Task ${taskNumber} created` });
  } finally { client.release(); }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  await ensureTables();
  const body = await req.json() as Record<string, unknown>;
  const pool = getPool(); const client = await pool.connect();
  try {
    const r = await client.query(
      `UPDATE cline_tasks SET status=$1,tokens_used=$2,cost_usd=$3,output_summary=$4,diff_preview=$5,completed_at=NOW()
       WHERE id=$6 RETURNING *`,
      [body.status ?? 'completed', body.tokens_used ?? null, body.cost_usd ?? null,
       body.output_summary ?? null, body.diff_preview ?? null, body.id]
    );
    return Response.json(r.rows[0] ?? { error: 'Not found' });
  } finally { client.release(); }
}
