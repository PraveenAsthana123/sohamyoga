import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS adj_adjusters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        aic_license_number TEXT,
        license_class TEXT DEFAULT 'independent',
        license_expiry DATE,
        eando_insurer TEXT,
        eando_expiry DATE,
        specializations TEXT[],
        active_claim_count INT DEFAULT 0,
        status TEXT DEFAULT 'available',
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS adj_claims (
        id SERIAL PRIMARY KEY,
        claim_number TEXT NOT NULL UNIQUE,
        insurer_name TEXT NOT NULL,
        insurer_file_number TEXT,
        insured_name TEXT NOT NULL,
        insured_phone TEXT,
        insured_email TEXT,
        loss_address TEXT,
        loss_date DATE,
        report_date DATE DEFAULT CURRENT_DATE,
        claim_type TEXT DEFAULT 'property',
        cause_of_loss TEXT,
        policy_number TEXT,
        deductible_amount NUMERIC(12,2) DEFAULT 0,
        coverage_limit NUMERIC(12,2),
        reserve_amount NUMERIC(12,2) DEFAULT 0,
        total_payments NUMERIC(12,2) DEFAULT 0,
        status TEXT DEFAULT 'new',
        priority TEXT DEFAULT 'standard',
        adjuster_id INT REFERENCES adj_adjusters(id),
        insurer_contact_name TEXT,
        insurer_contact_email TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS adj_inspections (
        id SERIAL PRIMARY KEY,
        claim_id INT REFERENCES adj_claims(id) ON DELETE CASCADE,
        inspection_type TEXT DEFAULT 'initial',
        scheduled_date DATE,
        completed_date DATE,
        adjuster_id INT REFERENCES adj_adjusters(id),
        inspection_address TEXT,
        findings_summary TEXT,
        estimated_repair_cost NUMERIC(12,2),
        depreciation_applied NUMERIC(12,2) DEFAULT 0,
        actual_cash_value NUMERIC(12,2),
        replacement_cost_value NUMERIC(12,2),
        contractor_estimates JSONB DEFAULT '[]',
        photos_count INT DEFAULT 0,
        report_submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS adj_payments (
        id SERIAL PRIMARY KEY,
        claim_id INT REFERENCES adj_claims(id) ON DELETE CASCADE,
        payment_type TEXT DEFAULT 'structural',
        payee_name TEXT NOT NULL,
        payee_type TEXT DEFAULT 'insured',
        cheque_number TEXT,
        payment_date DATE DEFAULT CURRENT_DATE,
        amount NUMERIC(12,2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM adj_adjusters`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO adj_adjusters (name, email, phone, aic_license_number, license_class, license_expiry, eando_insurer, eando_expiry, specializations, status)
        VALUES
          ('Doug Hartwell', 'doug@hartwell-adjusting.ca', '403-555-0111', 'AIC-2024-1047', 'independent', '2026-12-31', 'Lloyd''s of London Canada', '2027-03-31', ARRAY['property','hail','fire'], 'available'),
          ('Priya Sharma', 'priya@hartwell-adjusting.ca', '403-555-0222', 'AIC-2023-0882', 'independent', '2025-11-30', 'Intact Insurance', '2026-09-30', ARRAY['auto','DCPD','total_loss'], 'busy'),
          ('Kevin Oulton', 'kevin@hartwell-adjusting.ca', '587-555-0333', 'AIC-2022-0559', 'staff', '2025-10-15', 'Aviva Canada', '2025-12-31', ARRAY['commercial','liability','flood'], 'available')
      `);
      await client.query(`
        INSERT INTO adj_claims (claim_number, insurer_name, insurer_file_number, insured_name, insured_phone, insured_email, loss_address, loss_date, claim_type, cause_of_loss, policy_number, deductible_amount, coverage_limit, reserve_amount, status, priority, adjuster_id, insurer_contact_name, insurer_contact_email)
        VALUES
          ('ADJ-2026-0001', 'Intact Insurance', 'INT-26-884421', 'Morrison, Brian', '403-555-2001', 'brian.morrison@email.ca', '142 Elbow Dr SW, Calgary AB', '2026-09-01', 'hail', 'Hailstorm event Sept 1', 'HO-2024-55231', 2000, 650000, 28500, 'inspection_scheduled', 'urgent', 1, 'Lisa Park', 'lisa.park@intact.ca'),
          ('ADJ-2026-0002', 'Wawanesa Mutual', 'WAW-26-112233', 'Nguyen, Thanh', '780-555-3002', 'tnguyen@email.ca', '88 River Valley Rd, Edmonton AB', '2026-08-28', 'property', 'Basement flooding', 'HO-2023-91034', 2500, 500000, 42000, 'in_review', 'standard', 3, 'Mark Stevens', 'm.stevens@wawanesa.com'),
          ('ADJ-2026-0003', 'Aviva Canada', 'AVI-26-556677', 'Leblanc, Sophie', '403-555-4003', 'sophielblanc@email.ca', '2019 Spruce Meadows Way SW, Calgary AB', '2026-09-05', 'auto', 'Rear-end collision DCPD', 'AUTO-2025-77821', 500, 100000, 8800, 'assigned', 'standard', 2, 'Tom Grier', 'tgrier@aviva.ca'),
          ('ADJ-2026-0004', 'Co-operators', 'COOP-26-009922', 'Blackfoot Trading Co.', '403-555-5004', 'claims@blackfoot.ca', '400 5th Ave SW, Calgary AB', '2026-09-10', 'commercial', 'Sprinkler discharge water damage', 'COMM-2024-33210', 5000, 2000000, 115000, 'new', 'urgent', NULL, 'Dana Wells', 'dwells@cooperators.ca'),
          ('ADJ-2026-0005', 'TD Insurance', 'TD-26-445566', 'Kowalski, Anna', '780-555-6005', 'akowalski@email.ca', '55 Tamarack Blvd, Fort McMurray AB', '2026-05-15', 'fire', 'Wildfire evacuation — total loss', 'HO-2022-19284', 1000, 850000, 810000, 'negotiating', 'catastrophe', 1, 'Rachel Kim', 'rkim@tdinsurance.com')
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
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [openClaims, closedMtd, avgDays, reserves, paymentsMtd, adjCount] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM adj_claims WHERE status NOT IN ('closed','denied','settled')`),
        client.query(`SELECT COUNT(*) AS n FROM adj_claims WHERE status IN ('closed','settled') AND created_at >= date_trunc('month', NOW())`),
        client.query(`SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW()-created_at))/86400)) AS avg_days FROM adj_claims WHERE status IN ('closed','settled')`),
        client.query(`SELECT COALESCE(SUM(reserve_amount),0) AS total FROM adj_claims WHERE status NOT IN ('closed','denied')`),
        client.query(`SELECT COALESCE(SUM(amount),0) AS total FROM adj_payments WHERE payment_date >= date_trunc('month', CURRENT_DATE)`),
        client.query(`SELECT COUNT(*) AS n FROM adj_adjusters WHERE is_active=true`),
      ]);
      return Response.json({
        open_claims: Number(openClaims.rows[0].n),
        claims_closed_mtd: Number(closedMtd.rows[0].n),
        avg_days_to_close: Number(avgDays.rows[0].avg_days ?? 0),
        total_reserves: Number(reserves.rows[0].total),
        total_payments_mtd: Number(paymentsMtd.rows[0].total),
        adjuster_count: Number(adjCount.rows[0].n),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('insurance-adjusting GET error:', err);
    return Response.json({ error: 'Server error.' }, { status: 500 });
  }
}
