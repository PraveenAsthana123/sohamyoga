import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ locations: [], compliance: [], summary: { totalLocations: 0, activeLocations: 0, totalRevenue: 0, totalRoyalties: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS franchise_location (
        id SERIAL PRIMARY KEY,
        location_name TEXT NOT NULL,
        address TEXT,
        territory_km NUMERIC(8,2) DEFAULT 0,
        franchisee_name TEXT,
        email TEXT,
        phone TEXT,
        opening_date DATE,
        monthly_revenue NUMERIC(10,2) DEFAULT 0,
        royalty_pct NUMERIC(5,2) DEFAULT 6,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS franchise_compliance (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES franchise_location(id) ON DELETE CASCADE,
        check_type TEXT,
        result TEXT DEFAULT 'pending',
        inspector TEXT,
        checked_date DATE,
        notes TEXT,
        status TEXT DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [locationsRes, complianceRes] = await Promise.all([
      client.query(`SELECT * FROM franchise_location ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT fc.*, fl.location_name FROM franchise_compliance fc LEFT JOIN franchise_location fl ON fl.id = fc.location_id ORDER BY fc.checked_date DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const locations: Array<{ status: string; monthly_revenue: number; royalty_pct: number }> = locationsRes.rows;
    const summary = {
      totalLocations: locations.length,
      activeLocations: locations.filter(l => l.status === 'active').length,
      totalRevenue: locations.reduce((s, l) => s + Number(l.monthly_revenue ?? 0), 0),
      totalRoyalties: locations.reduce((s, l) => s + (Number(l.monthly_revenue ?? 0) * Number(l.royalty_pct ?? 0) / 100), 0),
    };

    return Response.json({ locations: locationsRes.rows, compliance: complianceRes.rows, summary });
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
      `INSERT INTO franchise_location (location_name, address, territory_km, franchisee_name, email, phone, royalty_pct, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [body.location_name ?? '', body.address ?? '', body.territory_km ?? 0, body.franchisee_name ?? '', body.email ?? '', body.phone ?? '', body.royalty_pct ?? 6, body.status ?? 'active']
    );
    return Response.json({ location: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
