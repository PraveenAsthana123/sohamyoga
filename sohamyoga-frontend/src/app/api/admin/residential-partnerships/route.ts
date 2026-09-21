import { NextRequest } from 'next/server';
import { getPool, databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ buildings: [], promos: [], summary: { totalBuildings: 0, activeBuildings: 0, totalUnits: 0 } });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS residential_building (
        id SERIAL PRIMARY KEY,
        building_name TEXT NOT NULL,
        address TEXT,
        manager_name TEXT,
        manager_email TEXT,
        unit_count INTEGER DEFAULT 0,
        partnership_type TEXT DEFAULT 'resident-discount',
        monthly_orders INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS resident_promo (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES residential_building(id) ON DELETE SET NULL,
        promo_code TEXT,
        discount_pct NUMERIC(5,2) DEFAULT 0,
        redemptions INTEGER DEFAULT 0,
        valid_until DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [buildingsRes, promosRes] = await Promise.all([
      client.query(`SELECT * FROM residential_building ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT rp.*, rb.building_name FROM resident_promo rp LEFT JOIN residential_building rb ON rb.id = rp.building_id ORDER BY rp.created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
    ]);

    const buildings: Array<{ status: string; unit_count: number }> = buildingsRes.rows;
    const summary = {
      totalBuildings: buildings.length,
      activeBuildings: buildings.filter(b => b.status === 'active').length,
      totalUnits: buildings.reduce((s, b) => s + Number(b.unit_count ?? 0), 0),
    };

    return Response.json({ buildings: buildingsRes.rows, promos: promosRes.rows, summary });
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
      `INSERT INTO residential_building (building_name, address, manager_name, manager_email, unit_count, partnership_type, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.building_name ?? '', body.address ?? '', body.manager_name ?? '', body.manager_email ?? '', body.unit_count ?? 0, body.partnership_type ?? 'resident-discount', body.status ?? 'active']
    );
    return Response.json({ building: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
