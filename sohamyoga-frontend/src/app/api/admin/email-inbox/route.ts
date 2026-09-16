import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS email_message (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    thread_id TEXT,
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_address TEXT,
    subject TEXT,
    body_preview TEXT,
    body_html TEXT,
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    label TEXT DEFAULT 'inbox',
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const label = searchParams.get('label');
  const is_read = searchParams.get('is_read');
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (label) { conditions.push(`label = $${idx++}`); values.push(label); }
  if (is_read !== null) { conditions.push(`is_read = $${idx++}`); values.push(is_read === 'true'); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM email_message ${where} ORDER BY is_read ASC, received_at DESC LIMIT 200`,
    values
  );
  const { rows: unreadRows } = await pool.query(
    `SELECT COUNT(*) as count FROM email_message WHERE is_read = false AND label = 'inbox'`
  );
  return Response.json({ messages: rows, unread_count: parseInt(unreadRows[0]?.count || '0') });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.from_address) return Response.json({ error: 'from_address is required' }, { status: 400 });
  const { rows } = await pool.query(
    `INSERT INTO email_message (message_id, thread_id, from_address, from_name, to_address, subject, body_preview, body_html, label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [b.message_id || null, b.thread_id || null, b.from_address, b.from_name || null,
     b.to_address || null, b.subject || null, b.body_preview || null, b.body_html || null,
     b.label || 'inbox']
  );
  return Response.json({ message: rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const b = await req.json().catch(() => null);
  if (!b?.id) return Response.json({ error: 'id is required' }, { status: 400 });
  const fields = ['is_read','is_starred','is_archived','label','subject','body_preview','body_html'];
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const f of fields) {
    if (f in b) { setClauses.push(`${f} = $${idx++}`); values.push(b[f]); }
  }
  if (!setClauses.length) return Response.json({ error: 'No fields to update' }, { status: 400 });
  values.push(b.id);
  const { rows } = await pool.query(
    `UPDATE email_message SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ message: rows[0] });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  await ensureTable();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });
  await pool.query(`DELETE FROM email_message WHERE id = $1`, [id]);
  return Response.json({ ok: true });
}
