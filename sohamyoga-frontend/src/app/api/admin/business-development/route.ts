import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';
import type { PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pool = getPool();

async function ensureTables(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS bd_opportunity (
      id SERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      opportunity_type TEXT DEFAULT 'partnership',
      stage TEXT DEFAULT 'prospecting',
      deal_value NUMERIC DEFAULT 0,
      probability_pct INTEGER DEFAULT 10,
      expected_close_date DATE,
      source TEXT,
      industry TEXT,
      notes TEXT,
      assigned_to TEXT,
      last_activity_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS bd_activity (
      id SERIAL PRIMARY KEY,
      opportunity_id INTEGER REFERENCES bd_opportunity(id) ON DELETE CASCADE,
      activity_type TEXT DEFAULT 'note',
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      outcome TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(_req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(_req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await ensureTables(client);

    const [opps, stages, activities] = await Promise.all([
      client.query(`
        SELECT o.*,
          (SELECT COUNT(*) FROM bd_activity a WHERE a.opportunity_id = o.id) AS activity_count
        FROM bd_opportunity o
        ORDER BY o.created_at DESC
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT stage,
          COUNT(*) AS count,
          SUM(deal_value) AS total_value,
          SUM(deal_value * probability_pct / 100.0) AS weighted_value
        FROM bd_opportunity
        GROUP BY stage
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT a.*, o.company_name
        FROM bd_activity a
        JOIN bd_opportunity o ON o.id = a.opportunity_id
        ORDER BY a.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] })),
    ]);

    const totalPipeline = (opps.rows as Array<{ deal_value: string; probability_pct: number }>)
      .reduce((sum, r) => sum + Number(r.deal_value) * (r.probability_pct / 100), 0);

    return Response.json({
      opportunities: opps.rows,
      stageCounts: stages.rows,
      recentActivities: activities.rows,
      totalWeightedPipeline: totalPipeline,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.company_name) {
    return Response.json({ error: 'company_name is required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureTables(client);
    const result = await client.query(
      `INSERT INTO bd_opportunity
        (company_name, contact_name, contact_email, contact_phone, opportunity_type,
         stage, deal_value, probability_pct, expected_close_date, source, industry,
         notes, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        body.company_name, body.contact_name ?? null, body.contact_email ?? null,
        body.contact_phone ?? null, body.opportunity_type ?? 'partnership',
        body.stage ?? 'prospecting', Number(body.deal_value ?? 0),
        Number(body.probability_pct ?? 10), body.expected_close_date ?? null,
        body.source ?? null, body.industry ?? null, body.notes ?? null,
        body.assigned_to ?? null,
      ]
    );
    return Response.json({ opportunity: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.id) {
    return Response.json({ error: 'id is required.' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureTables(client);
    const result = await client.query(
      `UPDATE bd_opportunity SET
        stage = COALESCE($2, stage),
        probability_pct = COALESCE($3, probability_pct),
        notes = COALESCE($4, notes),
        assigned_to = COALESCE($5, assigned_to),
        deal_value = COALESCE($6, deal_value),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        body.id, body.stage ?? null, body.probability_pct ?? null,
        body.notes ?? null, body.assigned_to ?? null, body.deal_value ?? null,
      ]
    );
    if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ opportunity: result.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });

  const client = await pool.connect();
  try {
    await ensureTables(client);
    await client.query('DELETE FROM bd_opportunity WHERE id = $1', [id]);
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
