export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trace (
        id BIGSERIAL PRIMARY KEY,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        parent_span_id TEXT,
        operation TEXT NOT NULL,
        service TEXT DEFAULT 'sohamyoga',
        status TEXT DEFAULT 'ok',
        duration_ms INTEGER,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        tags JSONB DEFAULT '{}',
        error_message TEXT,
        sampled BOOLEAN DEFAULT true
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS trace_trace_id_idx ON trace(trace_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS trace_started_at_idx ON trace(started_at DESC)`);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        t.trace_id,
        root.operation,
        root.service,
        root.status,
        root.started_at,
        COUNT(t.id)::int AS span_count,
        SUM(t.duration_ms)::int AS total_duration_ms
      FROM trace t
      JOIN LATERAL (
        SELECT operation, service, status, started_at
        FROM trace
        WHERE trace_id = t.trace_id AND parent_span_id IS NULL
        ORDER BY started_at ASC
        LIMIT 1
      ) root ON true
      GROUP BY t.trace_id, root.operation, root.service, root.status, root.started_at
      ORDER BY root.started_at DESC
      LIMIT 100
    `).catch(() => ({ rows: [] }));
    return Response.json({ traces: rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureSchema().catch(() => {});

  const body = await req.json().catch(() => ({}));
  const { trace_id, span_id, parent_span_id, operation, service, status, duration_ms, tags, error_message } = body;
  if (!operation) return Response.json({ error: 'operation is required' }, { status: 400 });

  const tid = trace_id || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sid = span_id || `span-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `INSERT INTO trace (trace_id, span_id, parent_span_id, operation, service, status, duration_ms, tags, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING *`,
      [tid, sid, parent_span_id || null, operation, service || 'sohamyoga', status || 'ok', duration_ms || null, JSON.stringify(tags || {}), error_message || null]
    ).catch(() => ({ rows: [] }));
    return Response.json({ span: rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
