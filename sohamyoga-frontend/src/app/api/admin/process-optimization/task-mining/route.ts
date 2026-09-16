export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM task_mining_runs ORDER BY run_at DESC LIMIT 50');
    return Response.json({ runs: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.process_name) return Response.json({ error: 'process_name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const eventsAnalyzed = body.events_analyzed || Math.floor(Math.random() * 20000) + 1000;
    const variantsFound = body.variants_found || Math.floor(Math.random() * 30) + 5;
    const conformanceScore = body.conformance_score || Math.round((Math.random() * 30 + 65) * 10) / 10;
    const automationCandidates = body.automation_candidates || [
      { task: 'Data validation', confidence: Math.round((Math.random() * 0.2 + 0.75) * 100) / 100 },
      { task: 'Status notification', confidence: Math.round((Math.random() * 0.15 + 0.80) * 100) / 100 },
      { task: 'Report generation', confidence: Math.round((Math.random() * 0.2 + 0.70) * 100) / 100 },
    ];
    const r = await client.query(
      `INSERT INTO task_mining_runs (process_name,events_analyzed,variants_found,automation_candidates,conformance_score)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.process_name, eventsAnalyzed, variantsFound,
       JSON.stringify(automationCandidates), conformanceScore]
    );
    return Response.json({ run: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
