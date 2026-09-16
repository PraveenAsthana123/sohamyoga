import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const opportunityId = searchParams.get('opportunity_id');

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT a.*, o.company_name
       FROM bd_activity a
       JOIN bd_opportunity o ON o.id = a.opportunity_id
       ${opportunityId ? 'WHERE a.opportunity_id = $1' : ''}
       ORDER BY a.created_at DESC
       LIMIT 200`,
      opportunityId ? [opportunityId] : []
    ).catch(() => ({ rows: [] }));

    return Response.json({ activities: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.opportunity_id || !body.title) {
    return Response.json({ error: 'opportunity_id and title are required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO bd_activity
        (opportunity_id, activity_type, title, description, scheduled_at,
         completed_at, outcome, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        body.opportunity_id, body.activity_type ?? 'note', body.title,
        body.description ?? null, body.scheduled_at ?? null,
        body.completed_at ?? null, body.outcome ?? null, body.created_by ?? null,
      ]
    );

    // Update last_activity_at on the opportunity
    await client.query(
      'UPDATE bd_opportunity SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [body.opportunity_id]
    ).catch(() => null);

    return Response.json({ activity: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
