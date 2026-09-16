import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENSURE_TABLE = `
  CREATE TABLE IF NOT EXISTS popup_cta (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'modal',
    status TEXT DEFAULT 'draft',
    trigger_type TEXT DEFAULT 'timer',
    trigger_value TEXT,
    target_pages TEXT[],
    headline TEXT,
    body_text TEXT,
    cta_text TEXT,
    cta_url TEXT,
    background_color TEXT DEFAULT '#6366f1',
    text_color TEXT DEFAULT '#ffffff',
    show_once BOOLEAN DEFAULT true,
    show_after_close_days INTEGER DEFAULT 7,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    closes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

async function ensureTable(): Promise<void> {
  await pool.query(ENSURE_TABLE);
}

function computeCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return Math.round((clicks / impressions) * 10000) / 100;
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT id, name, type, status, trigger_type, trigger_value, target_pages,
              headline, body_text, cta_text, cta_url, background_color, text_color,
              show_once, show_after_close_days, impressions, clicks, closes, created_at, updated_at
       FROM popup_cta ORDER BY created_at DESC`,
    );
    const popups = result.rows.map(r => ({
      ...r,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      closes: Number(r.closes),
      ctr: computeCTR(Number(r.clicks), Number(r.impressions)),
    }));
    return Response.json({ popups });
  } catch (err) {
    console.error('GET /api/admin/popups error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const {
      name,
      type = 'modal',
      trigger_type = 'timer',
      trigger_value,
      target_pages,
      headline,
      body_text,
      cta_text,
      cta_url,
      background_color = '#6366f1',
      text_color = '#ffffff',
      show_once = true,
      show_after_close_days = 7,
    } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) {
      return Response.json({ error: 'name is required.' }, { status: 400 });
    }

    const pagesArray = Array.isArray(target_pages) ? target_pages : [];

    const result = await pool.query(
      `INSERT INTO popup_cta
        (name, type, trigger_type, trigger_value, target_pages, headline, body_text,
         cta_text, cta_url, background_color, text_color, show_once, show_after_close_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        name.trim(),
        typeof type === 'string' ? type : 'modal',
        typeof trigger_type === 'string' ? trigger_type : 'timer',
        typeof trigger_value === 'string' ? trigger_value : null,
        pagesArray,
        typeof headline === 'string' ? headline : null,
        typeof body_text === 'string' ? body_text : null,
        typeof cta_text === 'string' ? cta_text : null,
        typeof cta_url === 'string' ? cta_url : null,
        typeof background_color === 'string' ? background_color : '#6366f1',
        typeof text_color === 'string' ? text_color : '#ffffff',
        show_once === false ? false : true,
        typeof show_after_close_days === 'number' ? show_after_close_days : 7,
      ],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Failed to create popup.' }, { status: 500 });
    }
    return Response.json({ ok: true, id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/popups error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const { id, ...fields } = body as Record<string, unknown>;
    if (!id) {
      return Response.json({ error: 'id is required.' }, { status: 400 });
    }

    const ALLOWED_FIELDS = [
      'name', 'type', 'status', 'trigger_type', 'trigger_value', 'target_pages',
      'headline', 'body_text', 'cta_text', 'cta_url', 'background_color', 'text_color',
      'show_once', 'show_after_close_days', 'impressions', 'clicks', 'closes',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.includes(key)) {
        values.push(val);
        updates.push(`${key} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    values.push(Number(id));
    updates.push(`updated_at = NOW()`);

    const result = await pool.query(
      `UPDATE popup_cta SET ${updates.join(', ')} WHERE id = $${values.length - 1} RETURNING id`,
      values,
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Popup not found.' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/popups error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const { id } = body as Record<string, unknown>;
    if (!id) {
      return Response.json({ error: 'id is required.' }, { status: 400 });
    }

    const result = await pool.query(
      `DELETE FROM popup_cta WHERE id = $1 RETURNING id`,
      [Number(id)],
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Popup not found.' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/popups error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }
}
