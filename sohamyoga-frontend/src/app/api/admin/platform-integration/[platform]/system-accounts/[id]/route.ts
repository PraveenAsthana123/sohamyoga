import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ platform: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform, id } = await params;
  const accountId = parseInt(id, 10);
  if (isNaN(accountId)) return Response.json({ error: 'Invalid account ID' }, { status: 400 });

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = [
      'account_type', 'account_label', 'system_user_id', 'app_id',
      'scopes_granted', 'token_env_var', 'token_expires_at',
      'token_last_refreshed_at', 'token_status', 'is_primary', 'notes',
    ];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx}`);
        vals.push(body[key]);
        idx++;
      }
    }

    if (sets.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    vals.push(accountId, platform);

    const result = await query(
      `UPDATE platform_system_account SET ${sets.join(', ')} WHERE id = $${idx} AND platform = $${idx + 1} RETURNING *`,
      vals
    );

    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    return Response.json({ account: result.rows[0] });
  } catch (err) {
    console.error('system-accounts PATCH error:', err);
    return Response.json({ error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform, id } = await params;
  const accountId = parseInt(id, 10);
  if (isNaN(accountId)) return Response.json({ error: 'Invalid account ID' }, { status: 400 });

  try {
    const result = await query(
      'DELETE FROM platform_system_account WHERE id = $1 AND platform = $2 RETURNING id',
      [accountId, platform]
    );

    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('system-accounts DELETE error:', err);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
