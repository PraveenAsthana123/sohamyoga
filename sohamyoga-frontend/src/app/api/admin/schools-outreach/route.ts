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
      CREATE TABLE IF NOT EXISTS school_partner (
        id SERIAL PRIMARY KEY,
        institution_name TEXT NOT NULL,
        contact_name TEXT,
        email TEXT,
        phone TEXT,
        institution_type TEXT DEFAULT 'school',
        student_count INTEGER DEFAULT 0,
        partnership_type TEXT DEFAULT 'fundraising',
        discount_pct NUMERIC(5,2) DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS school_order (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER REFERENCES school_partner(id) ON DELETE SET NULL,
        institution_name TEXT,
        order_type TEXT DEFAULT 'catering',
        headcount INTEGER DEFAULT 0,
        amount NUMERIC(10,2) DEFAULT 0,
        order_date DATE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [partnersRes, ordersRes] = await Promise.all([
      client.query(`SELECT * FROM school_partner ORDER BY created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
      client.query(`SELECT * FROM school_order ORDER BY order_date DESC LIMIT 100`).catch(() => ({ rows: [] })),
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
      `INSERT INTO school_partner (institution_name, contact_name, email, phone, institution_type, student_count, partnership_type, discount_pct, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [body.institution_name ?? '', body.contact_name ?? '', body.email ?? '', body.phone ?? '', body.institution_type ?? 'school', body.student_count ?? 0, body.partnership_type ?? 'fundraising', body.discount_pct ?? 0, body.status ?? 'active']
    );
    return Response.json({ partner: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
