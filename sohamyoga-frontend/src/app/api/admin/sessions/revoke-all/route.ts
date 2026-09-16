export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { user_email?: string; reason?: string };
  if (!body.user_email) return Response.json({ error: 'user_email required' }, { status: 400 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE user_session
       SET is_active=false, revoked_at=NOW(), revoked_reason=$2
       WHERE user_email=$1 AND is_active=true`,
      [body.user_email, body.reason ?? 'admin_bulk_revoke']
    ).catch(() => ({ rowCount: 0 }));
    return Response.json({ ok: true, revoked: result.rowCount ?? 0 });
  } finally {
    client.release();
  }
}
