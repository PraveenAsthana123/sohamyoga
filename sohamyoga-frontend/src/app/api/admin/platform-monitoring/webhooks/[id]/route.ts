import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await req.json() as { action: 'process' | 'replay' };

    if (body.action === 'process') {
      await query(
        `UPDATE platform_webhook_event
         SET processed = true, processed_at = NOW(), processing_error = NULL
         WHERE id = $1`,
        [id],
      );
      return Response.json({ success: true, action: 'process', id });
    }

    if (body.action === 'replay') {
      // Re-insert the event as a new unprocessed row
      const existing = await query<{
        platform: string;
        event_type: string | null;
        payload: Record<string, unknown>;
        raw_body: string | null;
      }>(
        `SELECT platform, event_type, payload, raw_body FROM platform_webhook_event WHERE id = $1`,
        [id],
      );

      if (existing.rows.length === 0) {
        return Response.json({ error: 'Event not found' }, { status: 404 });
      }

      const ev = existing.rows[0];
      const newId = await query<{ id: number }>(
        `INSERT INTO platform_webhook_event
           (platform, event_type, event_id, payload, raw_body, signature_valid, processed)
         VALUES ($1, $2, $3, $4, $5, true, false)
         RETURNING id`,
        [
          ev.platform,
          ev.event_type,
          `replay_${Date.now()}`,
          typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload),
          ev.raw_body,
        ],
      );
      return Response.json({ success: true, action: 'replay', new_id: newId.rows[0].id });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[webhooks/id POST]', err);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    await query(`DELETE FROM platform_webhook_event WHERE id = $1`, [id]);
    return Response.json({ success: true, id });
  } catch (err) {
    console.error('[webhooks/id DELETE]', err);
    return Response.json({ error: 'Delete failed' }, { status: 500 });
  }
}
