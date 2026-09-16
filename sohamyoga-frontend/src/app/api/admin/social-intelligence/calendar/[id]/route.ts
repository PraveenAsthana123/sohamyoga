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
  const { scheduled_at, status, title, caption_preview } = body;
  const result = await query(
    `UPDATE social_calendar_entry SET
       scheduled_at = COALESCE($1, scheduled_at),
       status = COALESCE($2, status),
       title = COALESCE($3, title),
       caption_preview = COALESCE($4, caption_preview)
     WHERE id = $5 RETURNING *`,
    [scheduled_at ?? null, status ?? null, title ?? null, caption_preview ?? null, id],
  );
  if (!result.rowCount) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ entry: result.rows[0] });
}
