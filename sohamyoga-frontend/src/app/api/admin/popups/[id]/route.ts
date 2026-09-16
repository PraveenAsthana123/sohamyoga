import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

    const result = await pool.query(
      `SELECT id, name, type, status, trigger_type, trigger_value, target_pages,
              headline, body_text, cta_text, cta_url, background_color, text_color,
              show_once, show_after_close_days, impressions, clicks, closes, created_at, updated_at
       FROM popup_cta WHERE id = $1 AND status = 'active'`,
      [id],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Popup not found.' }, { status: 404 });
    }

    const row = result.rows[0];
    return Response.json({
      popup: {
        ...row,
        impressions: Number(row.impressions),
        clicks: Number(row.clicks),
        closes: Number(row.closes),
      },
    });
  } catch (err) {
    console.error('GET /api/admin/popups/[id] error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const id = Number(params.id);
    if (isNaN(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const { status } = body as Record<string, unknown>;
    const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'];

    if (typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
      return Response.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `UPDATE popup_cta SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [status, id],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Popup not found.' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/popups/[id] error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}
