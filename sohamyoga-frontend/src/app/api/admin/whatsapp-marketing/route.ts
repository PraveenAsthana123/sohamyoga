import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ contacts: [], messages: [], summary: { totalContacts: 0, totalMessages: 0, optInRate: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_contact (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        group_name TEXT,
        opt_in BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_message (
        id SERIAL PRIMARY KEY,
        message_type TEXT DEFAULT 'broadcast',
        content TEXT,
        recipient_count INTEGER DEFAULT 0,
        sent_at TIMESTAMPTZ,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [contactsRes, messagesRes] = await Promise.all([
      client.query(`SELECT * FROM whatsapp_contact ORDER BY created_at DESC LIMIT 200`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM whatsapp_message ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const contacts: Array<{ opt_in: boolean }> = contactsRes.rows;
    const summary = {
      totalContacts: contacts.length,
      totalMessages: messagesRes.rows.length,
      optInRate: contacts.length > 0 ? Math.round((contacts.filter(c => c.opt_in).length / contacts.length) * 100) : 0,
    };

    return Response.json({ contacts: contactsRes.rows, messages: messagesRes.rows, summary });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'contact') {
      const result = await client.query(
        `INSERT INTO whatsapp_contact (name, phone, group_name, opt_in) VALUES ($1,$2,$3,$4) RETURNING *`,
        [body.name ?? '', body.phone ?? '', body.group_name ?? '', body.opt_in !== false]
      );
      return Response.json({ contact: result.rows[0] }, { status: 201 });
    } else {
      const result = await client.query(
        `INSERT INTO whatsapp_message (message_type, content, recipient_count, status) VALUES ($1,$2,$3,$4) RETURNING *`,
        [body.message_type ?? 'broadcast', body.content ?? '', body.recipient_count ?? 0, body.status ?? 'draft']
      );
      return Response.json({ message: result.rows[0] }, { status: 201 });
    }
  } finally {
    client.release();
  }
}
