export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

async function ensureTables(client: Awaited<ReturnType<typeof pool.connect>>) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS legal_client (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
      company_name TEXT, date_of_birth DATE,
      address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
      matter_type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      conflict_checked BOOLEAN DEFAULT false, retainer_amount NUMERIC(10,2),
      retainer_balance NUMERIC(10,2) DEFAULT 0, hourly_rate NUMERIC(8,2),
      source TEXT, referred_by TEXT, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS legal_matter (
      id SERIAL PRIMARY KEY, client_id INT REFERENCES legal_client(id) ON DELETE CASCADE,
      matter_number TEXT UNIQUE,
      title TEXT NOT NULL, matter_type TEXT NOT NULL,
      description TEXT, court_file_number TEXT, opposing_party TEXT,
      assigned_lawyer TEXT, assigned_paralegal TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      open_date DATE DEFAULT CURRENT_DATE, close_date DATE,
      estimated_hours NUMERIC(8,2), billed_hours NUMERIC(8,2) DEFAULT 0,
      total_fees NUMERIC(12,2) DEFAULT 0, disbursements NUMERIC(10,2) DEFAULT 0,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS legal_time_entry (
      id SERIAL PRIMARY KEY, matter_id INT REFERENCES legal_matter(id) ON DELETE CASCADE,
      date DATE DEFAULT CURRENT_DATE, description TEXT NOT NULL,
      hours NUMERIC(6,2) NOT NULL, rate NUMERIC(8,2),
      amount NUMERIC(10,2) GENERATED ALWAYS AS (hours * rate) STORED,
      billed BOOLEAN DEFAULT false, invoiced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS legal_deadline (
      id SERIAL PRIMARY KEY, matter_id INT REFERENCES legal_matter(id) ON DELETE CASCADE,
      title TEXT NOT NULL, deadline_date DATE NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await ensureTables(client);

    const [stats, clients, deadlines] = await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM legal_matter WHERE status='open') AS open_matters,
          (SELECT COALESCE(SUM(te.hours * te.rate),0) FROM legal_time_entry te WHERE te.billed=false) AS unbilled_wip,
          (SELECT COALESCE(SUM(retainer_balance),0) FROM legal_client) AS trust_balance,
          (SELECT COUNT(*) FROM legal_client WHERE status='active') AS active_clients,
          (SELECT COUNT(*) FROM legal_deadline WHERE deadline_date <= CURRENT_DATE + 14 AND status='pending') AS critical_deadlines
      `),
      client.query(`
        SELECT lc.*, COUNT(lm.id) AS matter_count
        FROM legal_client lc
        LEFT JOIN legal_matter lm ON lm.client_id=lc.id
        GROUP BY lc.id
        ORDER BY lc.created_at DESC LIMIT 100
      `),
      client.query(`
        SELECT ld.*, lm.title AS matter_title, lc.name AS client_name
        FROM legal_deadline ld
        LEFT JOIN legal_matter lm ON lm.id=ld.matter_id
        LEFT JOIN legal_client lc ON lc.id=lm.client_id
        WHERE ld.deadline_date <= CURRENT_DATE + 14 AND ld.status='pending'
        ORDER BY ld.deadline_date
      `),
    ]);

    return Response.json({ stats: stats.rows[0], clients: clients.rows, criticalDeadlines: deadlines.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const client = await pool.connect();
  try {
    await ensureTables(client);
    const body = await req.json();
    const { name, email, phone, company_name, date_of_birth, address, city, province,
      matter_type, status, retainer_amount, retainer_balance, hourly_rate,
      source, referred_by, notes } = body;

    if (!name || !matter_type) return Response.json({ error: 'name and matter_type required' }, { status: 400 });

    const r = await client.query(`
      INSERT INTO legal_client (name,email,phone,company_name,date_of_birth,address,city,province,
        matter_type,status,retainer_amount,retainer_balance,hourly_rate,source,referred_by,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [name,email,phone,company_name,date_of_birth,address,city||'Calgary',province||'AB',
        matter_type,status||'active',retainer_amount,retainer_balance||0,hourly_rate,source,referred_by,notes]);

    return Response.json({ client: r.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
