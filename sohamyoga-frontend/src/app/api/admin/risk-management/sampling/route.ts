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
    const r = await client.query('SELECT * FROM audit_samples ORDER BY created_at DESC');
    return Response.json({ samples: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.population_name || !body?.population_size) return Response.json({ error: 'population_name and population_size required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const exceptionRate = body.sample_size && body.exceptions_found
      ? Math.round((body.exceptions_found / body.sample_size) * 1000) / 10 : 0;
    const r = await client.query(
      `INSERT INTO audit_samples (population_name,population_size,sample_size,method,items_sampled,exceptions_found,exception_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.population_name, body.population_size, body.sample_size || 0,
       body.method || 'random', JSON.stringify(body.items_sampled || []),
       body.exceptions_found || 0, exceptionRate]
    );
    return Response.json({ sample: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
