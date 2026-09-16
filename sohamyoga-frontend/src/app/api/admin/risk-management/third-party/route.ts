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
    const r = await client.query('SELECT * FROM third_party_risks ORDER BY criticality DESC, last_assessment DESC NULLS LAST');
    return Response.json({ vendors: r.rows });
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body?.vendor_name) return Response.json({ error: 'vendor_name required' }, { status: 400 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO third_party_risks (vendor_name,service,data_shared,criticality,last_assessment,risk_level,findings,next_review)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.vendor_name, body.service || null,
       body.data_shared || [], body.criticality || 'medium',
       body.last_assessment || null, body.risk_level || 'medium',
       body.findings || [], body.next_review || null]
    );
    return Response.json({ vendor: r.rows[0] }, { status: 201 });
  } finally { client.release(); }
}
