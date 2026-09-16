import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM digital_card_links WHERE card_id = $1 ORDER BY order_index`,
      [params.id]
    );
    return Response.json({ links: rows });
  } catch (err) {
    console.error('[digital-cards/[id]/links GET]', err);
    return Response.json({ error: 'Failed to load links.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    if (!body.label?.trim()) return Response.json({ error: 'label is required.' }, { status: 400 });
    if (!body.url?.trim()) return Response.json({ error: 'url is required.' }, { status: 400 });

    // Check card exists
    const cardCheck = await pool.query('SELECT id FROM digital_cards WHERE id = $1', [params.id]);
    if (!cardCheck.rowCount) return Response.json({ error: 'Card not found.' }, { status: 404 });

    // Get next order_index
    const orderRes = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM digital_card_links WHERE card_id = $1',
      [params.id]
    );
    const orderIndex = body.order_index ?? orderRes.rows[0].next_idx;

    const { rows } = await pool.query(
      `INSERT INTO digital_card_links (card_id, label, url, icon, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [params.id, body.label.trim(), body.url.trim(), body.icon || 'link', orderIndex, body.is_active !== false]
    );
    return Response.json({ link: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[digital-cards/[id]/links POST]', err);
    return Response.json({ error: 'Failed to create link.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  const pool = getPool();
  try {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('link_id');
    if (!linkId) return Response.json({ error: 'link_id query param required.' }, { status: 400 });

    const { rows } = await pool.query(
      `DELETE FROM digital_card_links WHERE id = $1 AND card_id = $2 RETURNING id`,
      [linkId, params.id]
    );
    if (!rows.length) return Response.json({ error: 'Link not found.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[digital-cards/[id]/links DELETE]', err);
    return Response.json({ error: 'Failed to delete link.' }, { status: 500 });
  }
}
