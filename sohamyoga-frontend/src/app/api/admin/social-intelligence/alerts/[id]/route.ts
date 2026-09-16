import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  await ensureSocialIntelligenceSchema();
  const body = await req.json();
  const { is_active, severity, threshold_value, notification_channels } = body;
  const result = await query(
    `UPDATE social_alert_rule SET
       is_active = COALESCE($1, is_active),
       severity = COALESCE($2, severity),
       threshold_value = COALESCE($3, threshold_value),
       notification_channels = COALESCE($4, notification_channels)
     WHERE id = $5 RETURNING *`,
    [is_active ?? null, severity ?? null, threshold_value ?? null, notification_channels ?? null, id],
  );
  if (!result.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ rule: result.rows[0] });
}
