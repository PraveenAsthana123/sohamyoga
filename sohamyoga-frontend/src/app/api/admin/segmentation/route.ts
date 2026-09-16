import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS customer_segment (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    segment_type TEXT DEFAULT 'rule',
    criteria JSONB,
    member_count INTEGER DEFAULT 0,
    last_computed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

async function computeMemberCount(criteria: unknown): Promise<number> {
  if (!criteria || typeof criteria !== 'object') return 0;
  const c = criteria as { field?: string; operator?: string; value?: unknown };
  if (c.field === 'plan' && c.operator === 'eq') {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM customer WHERE plan = $1`,
      [c.value]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    return parseInt(rows[0]?.count || '0');
  }
  if (c.field === 'status' && c.operator === 'eq') {
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM customer WHERE status = $1`,
      [c.value]
    ).catch(() => ({ rows: [{ count: '0' }] }));
    return parseInt(rows[0]?.count || '0');
  }
  return 0;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { rows } = await pool.query(`SELECT * FROM customer_segment ORDER BY created_at DESC LIMIT 500`);
  const segments = await Promise.all(
    rows.map(async (seg) => {
      const count = await computeMemberCount(seg.criteria).catch(() => 0);
      return { ...seg, member_count: count };
    })
  );
  return Response.json({ segments });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.name) return Response.json({ error: 'name is required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO customer_segment (name, description, segment_type, criteria, status, tags)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.name, b.description || null, b.segment_type || 'rule',
     b.criteria ? JSON.stringify(b.criteria) : null,
     b.status || 'active', b.tags || null]
  );
  return Response.json({ segment: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.id) return Response.json({ error: 'id is required' }, { status: 400 });
  // Recompute member_count
  const { rows: existing } = await pool.query(`SELECT criteria FROM customer_segment WHERE id = $1`, [b.id]);
  if (!existing.length) return Response.json({ error: 'Not found' }, { status: 404 });
  const count = await computeMemberCount(existing[0].criteria).catch(() => 0);
  const { rows } = await pool.query(
    `UPDATE customer_segment SET member_count = $1, last_computed_at = NOW() WHERE id = $2 RETURNING *`,
    [count, b.id]
  );
  return Response.json({ segment: rows[0] });
}
