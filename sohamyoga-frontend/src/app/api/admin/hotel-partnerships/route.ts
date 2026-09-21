import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ hotels: [], orders: [], summary: { totalHotels: 0, activeHotels: 0, totalRevenue: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_partner (
        id SERIAL PRIMARY KEY,
        hotel_name TEXT NOT NULL,
        address TEXT,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        room_count INTEGER DEFAULT 0,
        partnership_type TEXT DEFAULT 'guest-referral',
        monthly_orders INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_order (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES hotel_partner(id) ON DELETE SET NULL,
        hotel_name TEXT,
        order_type TEXT DEFAULT 'guest-delivery',
        room_count INTEGER DEFAULT 0,
        amount NUMERIC(10,2) DEFAULT 0,
        order_date DATE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [hotelsRes, ordersRes] = await Promise.all([
      client.query(`SELECT * FROM hotel_partner ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM hotel_order ORDER BY order_date DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const hotels: Array<{ status: string }> = hotelsRes.rows;
    const orders: Array<{ amount: number }> = ordersRes.rows;
    const summary = {
      totalHotels: hotels.length,
      activeHotels: hotels.filter(h => h.status === 'active').length,
      totalRevenue: orders.reduce((s, o) => s + Number(o.amount ?? 0), 0),
    };

    return Response.json({ hotels: hotelsRes.rows, orders: ordersRes.rows, summary });
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
      `INSERT INTO hotel_partner (hotel_name, address, contact_name, email, phone, room_count, partnership_type, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.hotel_name ?? '', body.address ?? '', body.contact_name ?? '', body.email ?? '', body.phone ?? '', body.room_count ?? 0, body.partnership_type ?? 'guest-referral', body.status ?? 'active']
    );
    return Response.json({ hotel: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
