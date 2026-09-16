import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTable(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agency_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name TEXT NOT NULL,
        industry TEXT,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        account_manager TEXT,
        status TEXT DEFAULT 'active',
        monthly_retainer_cad NUMERIC(10,2),
        contract_start DATE,
        contract_end DATE,
        total_spend_cad NUMERIC(12,2) DEFAULT 0,
        health_score INT DEFAULT 80,
        tags TEXT[],
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM agency_clients`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO agency_clients
          (company_name, industry, contact_name, contact_email, contact_phone, account_manager, status, monthly_retainer_cad, contract_start, contract_end, total_spend_cad, health_score, tags, notes)
        VALUES
          ('Maple Leaf Retail Co.', 'retail', 'Sandra Thornton', 'sandra@mapleleafretail.ca', '416-555-0101', 'jane@agency.ca', 'active', 3200.00, '2026-01-01', '2026-12-31', 28800.00, 88, ARRAY['ecommerce','seasonal'], 'Long-standing client; prefers weekly standups.'),
          ('Northern Health Solutions', 'healthcare', 'Dr. Ahmed Farooq', 'afarooq@nhsolutions.ca', '604-555-0202', 'mark@agency.ca', 'active', 4500.00, '2026-03-01', '2027-02-28', 40500.00, 92, ARRAY['hipaa','b2b'], 'Strict compliance requirements; all copy needs legal sign-off.'),
          ('Finvest Capital Group', 'finance', 'Rebecca Liu', 'rliu@finvestcapital.ca', '647-555-0303', 'jane@agency.ca', 'at_risk', 2800.00, '2025-07-01', '2026-06-30', 30800.00, 55, ARRAY['b2b','linkedin'], 'Health score dropped after Q2 campaign underperformance. Escalation call booked.'),
          ('BlueSky Tech Inc.', 'tech', 'Jordan Parker', 'jparker@blueskytech.ca', '778-555-0404', 'sarah@agency.ca', 'onboarding', 2200.00, '2026-09-01', '2027-08-31', 2200.00, 70, ARRAY['saas','startup'], 'New client — onboarding in progress. Brand assets received.'),
          ('Grand Harbour Hotels', 'hospitality', 'Marie Beaumont', 'mbeaumont@grandharbour.ca', '514-555-0505', 'mark@agency.ca', 'prospect', NULL, NULL, NULL, 0.00, 65, ARRAY['b2c','local'], 'Discovery call completed. Proposal sent 2026-09-10.')
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT * FROM agency_clients ORDER BY created_at DESC`
      );
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agency-clients GET error:', err);
    return Response.json({ error: 'Failed to fetch agency clients.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTable();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    const {
      company_name, industry, contact_name, contact_email, contact_phone,
      account_manager, status = 'active', monthly_retainer_cad,
      contract_start, contract_end, health_score = 80, tags, notes,
    } = body;
    if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
      return Response.json({ error: 'company_name is required.' }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO agency_clients
           (company_name, industry, contact_name, contact_email, contact_phone,
            account_manager, status, monthly_retainer_cad, contract_start,
            contract_end, health_score, tags, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          company_name.trim(), industry || null, contact_name || null,
          contact_email || null, contact_phone || null, account_manager || null,
          status, monthly_retainer_cad || null, contract_start || null,
          contract_end || null, health_score, tags || null, notes || null,
        ]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('agency-clients POST error:', err);
    return Response.json({ error: 'Failed to create agency client.' }, { status: 500 });
  }
}
