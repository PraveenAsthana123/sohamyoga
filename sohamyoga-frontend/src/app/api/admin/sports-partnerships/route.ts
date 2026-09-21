import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ partners: [], orders: [], summary: { totalPartners: 0, activePartners: 0, totalRevenue: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sports_partner (
        id SERIAL PRIMARY KEY,
        team_name TEXT NOT NULL,
        sport TEXT,
        league TEXT,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        player_count INTEGER DEFAULT 0,
        season_start DATE,
        season_end DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_day_order (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES sports_partner(id) ON DELETE SET NULL,
        team_name TEXT,
        game_date DATE,
        order_type TEXT DEFAULT 'team-meal',
        headcount INTEGER DEFAULT 0,
        amount NUMERIC(10,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [partnersRes, ordersRes] = await Promise.all([
      client.query(`SELECT * FROM sports_partner ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM game_day_order ORDER BY game_date DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const partners: Array<{ status: string }> = partnersRes.rows;
    const orders: Array<{ amount: number }> = ordersRes.rows;
    const summary = {
      totalPartners: partners.length,
      activePartners: partners.filter(p => p.status === 'active').length,
      totalRevenue: orders.reduce((s, o) => s + Number(o.amount ?? 0), 0),
    };

    return Response.json({ partners: partnersRes.rows, orders: ordersRes.rows, summary });
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
    const result = await client.query(
      `INSERT INTO sports_partner (team_name, sport, league, contact_name, email, phone, player_count, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.team_name ?? '', body.sport ?? '', body.league ?? '', body.contact_name ?? '', body.email ?? '', body.phone ?? '', body.player_count ?? 0, body.status ?? 'active']
    );
    return Response.json({ partner: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
