import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSocialIntelligenceSchema } from '@/lib/social-intelligence-schema';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
    [is_active ?? null, severity ?? null, threshold_value ?? null, notification_channels ?? null, params.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ rule: result.rows[0] });
}
