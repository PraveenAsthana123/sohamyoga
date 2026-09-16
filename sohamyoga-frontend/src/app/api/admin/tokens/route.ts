export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const tokenType = searchParams.get('token_type');

  const client = await pool.connect();
  try {
    const params: string[] = [];
    let where = '';
    if (tokenType) {
      params.push(tokenType);
      where = `WHERE token_type = $1`;
    }
    const result = await client.query(
      `SELECT id, token_type, user_id, user_email, scope, is_active,
              issued_at, expires_at, last_used_at, revoked_at, revoked_reason, metadata
       FROM auth_token
       ${where}
       ORDER BY issued_at DESC
       LIMIT 500`,
      params
    ).catch(() => ({ rows: [] }));
    return Response.json({ tokens: result.rows });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { id?: number; reason?: string };
  if (!body.id) return Response.json({ error: 'id required' }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE auth_token SET is_active=false, revoked_at=NOW(), revoked_reason=$2 WHERE id=$1`,
      [body.id, body.reason ?? 'admin_revoked']
    ).catch(() => {});
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
