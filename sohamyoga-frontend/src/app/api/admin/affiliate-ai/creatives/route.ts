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
    const { rows } = await client.query('SELECT * FROM affiliate_creatives ORDER BY created_at DESC');
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO affiliate_creatives (partner_id, format, headline, body, cta, ai_generated, ctr_prediction)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.partner_id, body.format, body.headline, body.body, body.cta, body.ai_generated ?? false, body.ctr_prediction || 0]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
