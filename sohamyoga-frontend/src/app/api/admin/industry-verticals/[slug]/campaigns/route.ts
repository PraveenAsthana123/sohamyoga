export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT * FROM vertical_campaigns WHERE vertical_slug = $1 ORDER BY created_at',
      [params.slug],
    );
    return Response.json({ campaigns: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid body.' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO vertical_campaigns (vertical_slug, campaign_name, campaign_type, target_segment, budget_estimate, expected_roas, channels, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        params.slug,
        body.campaign_name ?? 'New Campaign',
        body.campaign_type ?? '',
        body.target_segment ?? '',
        Number(body.budget_estimate) || 0,
        Number(body.expected_roas) || 0,
        Array.isArray(body.channels) ? body.channels : [],
        body.status ?? 'template',
      ],
    );
    return Response.json({ campaign: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
