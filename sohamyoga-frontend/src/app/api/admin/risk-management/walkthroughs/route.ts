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
    const r = await client.query('SELECT * FROM compliance_walkthroughs ORDER BY walkthrough_date DESC NULLS LAST');
    return Response.json({ walkthroughs: r.rows });
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
    const r = await client.query(
      `INSERT INTO compliance_walkthroughs (process_name,control_owner,walkthrough_date,tester,steps,findings,result)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.process_name, body.control_owner || null,
       body.walkthrough_date || null, body.tester || null,
       JSON.stringify(body.steps || []),
       body.findings || [], body.result || 'pass']
    );
    return Response.json({ walkthrough: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
