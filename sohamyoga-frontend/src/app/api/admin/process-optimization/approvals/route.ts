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
    const r = await client.query('SELECT * FROM approval_bottlenecks ORDER BY avg_wait_hours DESC');
    return Response.json({ bottlenecks: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.process_name || !body?.step_name) return Response.json({ error: 'process_name and step_name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO approval_bottlenecks (process_name,step_name,avg_wait_hours,approver,bypass_eligible,recommendation)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.process_name, body.step_name, body.avg_wait_hours || 0,
       body.approver || null, body.bypass_eligible || false, body.recommendation || null]
    );
    return Response.json({ bottleneck: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
