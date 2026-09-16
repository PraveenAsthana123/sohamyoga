import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT *,
        CASE WHEN goal_amount > 0 THEN ROUND(total_raised / goal_amount * 100, 1) ELSE 0 END as progress_pct,
        CASE WHEN end_date IS NOT NULL THEN (end_date - CURRENT_DATE) ELSE NULL END as days_remaining
       FROM np_campaign
       ${status ? 'WHERE status = $1' : ''}
       ORDER BY status, end_date`,
      status ? [status] : []
    );
    return NextResponse.json({ campaigns: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin(req);
  if (auth) return auth;

  const body = await req.json();
  const { name, description, campaign_type = 'annual_fund', goal_amount, start_date, end_date, status = 'planning' } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Auto-generate campaign code
  const code = `CAMP-${Date.now().toString(36).toUpperCase()}`;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO np_campaign (name, description, campaign_type, goal_amount, start_date, end_date, status, campaign_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, description, campaign_type, goal_amount, start_date, end_date, status, code]
    );
    return NextResponse.json({ campaign: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
