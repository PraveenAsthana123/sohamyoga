export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { query, databaseConfigured } from '@/lib/postgres';

async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS event_ticket_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    event_date DATE,
    venue TEXT,
    total_capacity INT DEFAULT 100,
    tickets_sold INT DEFAULT 0,
    ticket_price NUMERIC,
    early_bird_price NUMERIC,
    early_bird_until DATE,
    status TEXT DEFAULT 'on-sale',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ticket_registration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES event_ticket_config(id) ON DELETE CASCADE,
    attendee_name TEXT,
    email TEXT,
    ticket_type TEXT DEFAULT 'general',
    quantity INT DEFAULT 1,
    amount_paid NUMERIC,
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({ items: [], children: [] });
  try {
    await ensureSchema();
    const items = await query(`SELECT * FROM event_ticket_config ORDER BY created_at DESC LIMIT 200`);
    const children = await query(`SELECT * FROM ticket_registration ORDER BY created_at DESC LIMIT 500`);
    return Response.json({ items: items.rows, children: children.rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const result = await query(
      `INSERT INTO event_ticket_config (event_name, event_date, venue, ticket_price, early_bird_price, early_bird_until) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.event_name ?? null, body.event_date ?? null, body.venue ?? null, body.ticket_price ?? null, body.early_bird_price ?? null, body.early_bird_until ?? null]
    );
    return Response.json(result.rows[0], { status: 201 });
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  if (!databaseConfigured()) return Response.json({error: 'DB not configured'}, {status: 503});
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({error: 'id required'}, {status: 400});
    await query(`DELETE FROM event_ticket_config WHERE id = $1`, [id]);
    return Response.json({ok: true});
  } catch (e) {
    return Response.json({error: String(e)}, {status: 500});
  }
}
