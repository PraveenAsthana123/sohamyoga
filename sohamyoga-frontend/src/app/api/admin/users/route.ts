import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') ?? '';
  const status = searchParams.get('status') ?? '';

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: string[] = [];
    let idx = 1;
    if (role) { conditions.push(`role::text = $${idx++}`); values.push(role); }
    if (status) { conditions.push(`status = $${idx++}`); values.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users, summary, newThisWeek] = await Promise.all([
      client.query(
        `SELECT id, email, display_name, role::text AS role, status, created_at, last_login_at
         FROM app_user ${where}
         ORDER BY created_at DESC LIMIT 500`,
        values,
      ),
      client.query(
        `SELECT role::text AS role, COUNT(*)::int AS cnt
         FROM app_user GROUP BY role ORDER BY role`,
      ),
      client.query(
        `SELECT COUNT(*)::int AS cnt FROM app_user
         WHERE created_at >= NOW() - INTERVAL '7 days'`,
      ),
    ]);

    const roleCounts: Record<string, number> = {};
    for (const row of summary.rows) roleCounts[row.role] = row.cnt;

    return Response.json({
      users: users.rows,
      summary: {
        total: users.rows.length,
        roleCounts,
        newThisWeek: newThisWeek.rows[0].cnt,
        active: users.rows.filter((u: { status: string }) => u.status === 'active').length,
      },
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { id?: string; status?: string } | null;
  if (!body?.id || !body?.status) {
    return Response.json({ error: 'id and status are required.' }, { status: 400 });
  }
  const validStatuses = ['active', 'suspended', 'deleted'];
  if (!validStatuses.includes(body.status)) {
    return Response.json({ error: `status must be one of: ${validStatuses.join(', ')}.` }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE app_user SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [body.id, body.status],
    );
    if (!result.rowCount) return Response.json({ error: 'User not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } finally {
    client.release();
  }
}
