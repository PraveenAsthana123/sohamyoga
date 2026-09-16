import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';
import { ensureSchema } from '@/lib/module-intelligence-schema';

import { requireAdmin } from '@/lib/admin-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureSchema();
  const body = await req.json() as { is_configured?: boolean; severity?: string; threshold?: string; notification_channels?: string[] };
  const { id } = await params;

  const updates: string[] = [];
  const vals: unknown[] = [];

  if (body.is_configured !== undefined) { vals.push(body.is_configured); updates.push(`is_configured = $${vals.length}`); }
  if (body.severity) { vals.push(body.severity); updates.push(`severity = $${vals.length}`); }
  if (body.threshold) { vals.push(body.threshold); updates.push(`threshold = $${vals.length}`); }
  if (body.notification_channels) { vals.push(`{${body.notification_channels.join(',')}}`); updates.push(`notification_channels = $${vals.length}::text[]`); }

  if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

  vals.push(id);
  const result = await query(
    `UPDATE module_alert_scenario SET ${updates.join(', ')} WHERE id = $${vals.length} RETURNING *`,
    vals,
  );

  if (!result.rows.length) return Response.json({ error: 'Alert not found' }, { status: 404 });
  return Response.json(result.rows[0]);
}
