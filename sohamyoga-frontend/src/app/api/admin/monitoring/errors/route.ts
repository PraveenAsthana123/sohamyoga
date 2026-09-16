import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS error_log (
    id BIGSERIAL PRIMARY KEY,
    level TEXT DEFAULT 'error',
    message TEXT NOT NULL,
    stack_trace TEXT,
    route TEXT,
    user_agent TEXT,
    ip_address TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level') ?? '';
  const resolved = searchParams.get('resolved') ?? '';

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (level) {
      conditions.push(`level = $${values.length + 1}`);
      values.push(level);
    }
    if (resolved !== '') {
      conditions.push(`resolved = $${values.length + 1}`);
      values.push(resolved === 'true');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(
      `SELECT id, level, message, stack_trace, route, user_agent, ip_address,
              metadata, resolved, created_at
       FROM error_log ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      values,
    );

    return Response.json({ items: result.rows, total: result.rowCount });
  } finally {
    client.release();
  }
}

// Public endpoint for client-side error reporting
export async function POST(req: NextRequest): Promise<Response> {
  let body: { message?: string; route?: string; metadata?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, route, metadata } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent') ?? null;

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const result = await client.query(
      `INSERT INTO error_log (level, message, route, user_agent, ip_address, metadata)
       VALUES ('error', $1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [message.slice(0, 4000), route ?? null, userAgent, ip, metadata ? JSON.stringify(metadata) : null],
    );

    return Response.json({ ok: true, id: result.rows[0]?.id }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { id?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(CREATE_TABLE);
    const result = await client.query(
      `UPDATE error_log SET resolved = true WHERE id = $1 RETURNING id`,
      [id],
    );
    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ ok: true, id: result.rows[0]?.id });
  } finally {
    client.release();
  }
}
