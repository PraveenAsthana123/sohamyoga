export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

async function ensureTable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_block (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'task',
        assigned_to TEXT,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        duration_minutes INTEGER,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'planned',
        related_module TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTable().catch(() => {});

  const { searchParams } = new URL(req.url);
  const week = searchParams.get('week'); // ISO date of week start (Monday)

  const client = await pool.connect();
  try {
    let query: string;
    let params: unknown[];

    if (week) {
      // Return blocks for the 7 days starting from week param
      query = `
        SELECT * FROM time_block
        WHERE start_time >= $1::date
          AND start_time < ($1::date + INTERVAL '7 days')
        ORDER BY start_time ASC
      `;
      params = [week];
    } else {
      // Current week (Monday)
      query = `
        SELECT * FROM time_block
        WHERE start_time >= date_trunc('week', NOW())
          AND start_time < date_trunc('week', NOW()) + INTERVAL '7 days'
        ORDER BY start_time ASC
      `;
      params = [];
    }

    const result = await client.query(query, params).catch(() => ({ rows: [] }));
    return Response.json({ blocks: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    category?: string;
    assigned_to?: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    priority?: string;
    related_module?: string;
    notes?: string;
  };
  if (!body.title || !body.start_time || !body.end_time) {
    return Response.json({ error: 'title, start_time, end_time required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO time_block (title, category, assigned_to, start_time, end_time, duration_minutes, priority, related_module, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        body.title,
        body.category ?? 'task',
        body.assigned_to ?? null,
        body.start_time,
        body.end_time,
        body.duration_minutes ?? null,
        body.priority ?? 'medium',
        body.related_module ?? null,
        body.notes ?? null,
      ]
    ).catch(() => ({ rows: [] }));
    return Response.json({ ok: true, id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { id?: number; status?: string; notes?: string };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (body.status !== undefined) { fields.push(`status=$${idx++}`); params.push(body.status); }
    if (body.notes !== undefined) { fields.push(`notes=$${idx++}`); params.push(body.notes); }
    if (fields.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });
    params.push(body.id);
    await client.query(`UPDATE time_block SET ${fields.join(', ')} WHERE id=$${idx}`, params).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { id?: number };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM time_block WHERE id=$1`, [body.id]).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
