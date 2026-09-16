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
    const { rows } = await client.query('SELECT * FROM influencer_profiles ORDER BY ai_match_score DESC');
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
      `INSERT INTO influencer_profiles (handle, platform, niche, followers, engagement_rate, contact_email, status, ai_match_score)
       VALUES ($1,$2,$3,$4,$5,$6,'discovered',$7) RETURNING *`,
      [body.handle, body.platform, body.niche, body.followers || 0, body.engagement_rate || 0, body.contact_email, body.ai_match_score || 0]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
