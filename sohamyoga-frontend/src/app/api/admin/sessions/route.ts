export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

async function ensureTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_session (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        user_email TEXT,
        user_role TEXT DEFAULT 'customer',
        ip_address TEXT,
        user_agent TEXT,
        device_type TEXT,
        country TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_token (
        id SERIAL PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        token_type TEXT DEFAULT 'access',
        user_id INTEGER,
        user_email TEXT,
        scope TEXT[],
        is_active BOOLEAN DEFAULT true,
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  await ensureTables().catch(() => {});

  const client = await pool.connect();
  try {
    const [sessionsRes, tokensRes, statsRes] = await Promise.all([
      client.query(`
        SELECT id, session_id, user_id, user_email, user_role,
               ip_address, user_agent, device_type, country,
               is_active, created_at, last_seen_at, expires_at,
               revoked_at, revoked_reason
        FROM user_session
        WHERE is_active = true
        ORDER BY last_seen_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT id, token_type, user_id, user_email, scope,
               is_active, issued_at, expires_at, last_used_at,
               revoked_at, revoked_reason, metadata
        FROM auth_token
        ORDER BY issued_at DESC
        LIMIT 200
      `).catch(() => ({ rows: [] })),
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM user_session WHERE is_active = true) AS active_sessions,
          (SELECT COUNT(*) FROM auth_token WHERE is_active = true) AS active_tokens,
          (SELECT COUNT(*) FROM auth_token WHERE is_active = false AND expires_at < NOW()) AS expired_tokens,
          (SELECT COUNT(*) FROM user_session WHERE is_active = false AND revoked_at > NOW() - INTERVAL '1 day') AS revoked_today
      `).catch(() => ({ rows: [{ active_sessions: 0, active_tokens: 0, expired_tokens: 0, revoked_today: 0 }] })),
    ]);

    return Response.json({
      sessions: sessionsRes.rows,
      tokens: tokensRes.rows,
      stats: statsRes.rows[0] ?? { active_sessions: 0, active_tokens: 0, expired_tokens: 0, revoked_today: 0 },
    });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { session_id?: string };
  if (!body.session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE user_session SET is_active=false, revoked_at=NOW(), revoked_reason='admin_revoked'
       WHERE session_id=$1`,
      [body.session_id]
    ).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
