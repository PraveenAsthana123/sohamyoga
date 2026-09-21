import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ partners: [], events: [], summary: { totalPartners: 0, activePartners: 0, totalMonthlyOrders: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_partner (
        id SERIAL PRIMARY KEY,
        organization_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        neighborhood TEXT,
        partnership_type TEXT DEFAULT 'recurring',
        monthly_orders INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS community_event (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES community_partner(id) ON DELETE SET NULL,
        event_name TEXT,
        event_date DATE,
        expected_orders INTEGER DEFAULT 0,
        actual_orders INTEGER DEFAULT 0,
        status TEXT DEFAULT 'planned',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [partnersRes, eventsRes] = await Promise.all([
      client.query(`SELECT * FROM community_partner ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT ce.*, cp.organization_name FROM community_event ce LEFT JOIN community_partner cp ON cp.id = ce.partner_id ORDER BY ce.event_date DESC LIMIT 50`).catch(() => ({ rows: [] })),
    ]);

    const partners: Array<{ status: string; monthly_orders: number }> = partnersRes.rows;
    const summary = {
      totalPartners: partners.length,
      activePartners: partners.filter(p => p.status === 'active').length,
      totalMonthlyOrders: partners.reduce((s, p) => s + Number(p.monthly_orders ?? 0), 0),
    };

    return Response.json({ partners: partnersRes.rows, events: eventsRes.rows, summary });
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
      `INSERT INTO community_partner (organization_name, contact_name, email, phone, neighborhood, partnership_type, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.organization_name ?? '', body.contact_name ?? '', body.email ?? '', body.phone ?? '', body.neighborhood ?? '', body.partnership_type ?? 'recurring', body.status ?? 'active']
    );
    return Response.json({ partner: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
