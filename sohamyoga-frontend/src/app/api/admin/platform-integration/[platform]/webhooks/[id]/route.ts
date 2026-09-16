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
  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) return Response.json({ error: 'Invalid webhook ID' }, { status: 400 });

  try {
    const body = await req.json() as Record<string, unknown>;

    const allowed = ['webhook_url', 'events', 'is_active', 'verified', 'verify_token', 'last_event_at', 'event_count'];

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
    vals.push(webhookId, platform);

    const result = await query(
      `UPDATE platform_webhook_config SET ${sets.join(', ')} WHERE id = $${idx} AND platform = $${idx + 1} RETURNING *`,
      vals
    );

    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json({ webhook: result.rows[0] });
  } catch (err) {
    console.error('webhooks PATCH error:', err);
    return Response.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { platform, id } = await params;
  const webhookId = parseInt(id, 10);
  if (isNaN(webhookId)) return Response.json({ error: 'Invalid webhook ID' }, { status: 400 });

  try {
    const result = await query(
      'DELETE FROM platform_webhook_config WHERE id = $1 AND platform = $2 RETURNING id',
      [webhookId, platform]
    );

    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('webhooks DELETE error:', err);
    return Response.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
