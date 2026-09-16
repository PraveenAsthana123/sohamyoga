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
      CREATE TABLE IF NOT EXISTS engineering_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT,
        email TEXT, phone TEXT, company_type TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        engineering_discipline TEXT[],
        status TEXT DEFAULT 'active', preferred_contact TEXT,
        credit_terms INT DEFAULT 30,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS engineering_project (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES engineering_client(id) ON DELETE CASCADE,
        project_number TEXT UNIQUE, title TEXT NOT NULL,
        discipline TEXT NOT NULL, project_type TEXT,
        location TEXT, description TEXT,
        status TEXT DEFAULT 'proposal',
        priority TEXT DEFAULT 'normal',
        start_date DATE, end_date DATE,
        contract_value NUMERIC(12,2), contract_type TEXT DEFAULT 'lump_sum',
        budget_hours NUMERIC(8,2), actual_hours NUMERIC(8,2) DEFAULT 0,
        invoiced_amount NUMERIC(12,2) DEFAULT 0,
        pe_stamp_required BOOLEAN DEFAULT false,
        assigned_pe TEXT,
        permit_required BOOLEAN DEFAULT false, permit_number TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS engineering_deliverable (
        id SERIAL PRIMARY KEY, project_id INT REFERENCES engineering_project(id) ON DELETE CASCADE,
        title TEXT NOT NULL, deliverable_type TEXT,
        due_date DATE, submitted_date DATE,
        revision_number TEXT DEFAULT 'A',
        status TEXT DEFAULT 'pending',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS engineering_time_entry (
        id SERIAL PRIMARY KEY, project_id INT REFERENCES engineering_project(id),
        client_id INT REFERENCES engineering_client(id),
        date DATE DEFAULT CURRENT_DATE, staff_name TEXT, discipline TEXT,
        description TEXT NOT NULL, hours NUMERIC(6,2) NOT NULL, rate NUMERIC(8,2),
        billable BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM engineering_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO engineering_client (name, contact_person, email, phone, company_type, city, engineering_discipline, credit_terms, notes)
        VALUES
          ('City of Calgary', 'Jennifer Walsh', 'jwalsh@calgary.ca', '403-555-0201', 'municipal', 'Calgary', ARRAY['civil','structural','environmental'], 30, 'Municipal client — purchase order required.'),
          ('Apex Developments Inc.', 'Marcus Chen', 'mchen@apexdev.ca', '403-555-0202', 'developer', 'Calgary', ARRAY['civil','structural','geotechnical'], 45, 'Commercial developer; fast-track timelines.'),
          ('Alberta Infrastructure', 'Priya Sharma', 'psharma@gov.ab.ca', '780-555-0303', 'provincial', 'Edmonton', ARRAY['civil','structural','mechanical'], 30, 'Provincial — strict procurement rules.'),
          ('Northern Logistics Corp.', 'Dave MacKenzie', 'dmackenzie@northlog.ca', '403-555-0404', 'private', 'Calgary', ARRAY['mechanical','electrical','structural'], 30, 'Industrial client — Class 2 pressure vessels.'),
          ('Foothills Green Energy', 'Sophie Lavallee', 'slavallee@foothills.ca', '403-555-0505', 'private', 'Calgary', ARRAY['civil','electrical','environmental'], 30, 'Renewable energy — solar + wind projects.')
      `);
      await client.query(`
        INSERT INTO engineering_project (client_id, project_number, title, discipline, project_type, location, status, priority, start_date, end_date, contract_value, contract_type, budget_hours, actual_hours, pe_stamp_required, assigned_pe)
        VALUES
          (1, 'CGY-2026-001', 'Memorial Drive Roadway Rehabilitation', 'civil', 'road', 'Calgary, AB', 'active', 'high', '2026-06-01', '2026-12-31', 285000, 'lump_sum', 920, 410, true, 'Dr. James Thornton P.Eng.'),
          (2, 'APEX-2026-011', 'Beltline Mixed-Use Tower — Structural', 'structural', 'building', 'Calgary, AB', 'design', 'high', '2026-07-15', '2027-03-31', 540000, 'lump_sum', 1800, 620, true, 'Dr. Sarah Kim P.Eng.'),
          (3, 'GOA-2026-005', 'Highway 2 Bridge Inspection', 'structural', 'bridge', 'Red Deer, AB', 'proposal', 'normal', NULL, NULL, 95000, 'time_and_materials', 300, 0, true, 'Dr. James Thornton P.Eng.'),
          (4, 'NLC-2026-003', 'Compressor Station HVAC Upgrade', 'mechanical', 'HVAC', 'Lethbridge, AB', 'active', 'normal', '2026-08-01', '2026-11-30', 180000, 'lump_sum', 600, 280, true, 'Mark Oduya P.Eng.'),
          (1, 'CGY-2026-002', 'Stormwater Management Plan — NW Catchment', 'civil', 'drainage', 'Calgary, AB', 'review', 'normal', '2026-04-01', '2026-09-30', 145000, 'lump_sum', 480, 455, true, 'Dr. James Thornton P.Eng.')
      `);
      await client.query(`
        INSERT INTO engineering_deliverable (project_id, title, deliverable_type, due_date, revision_number, status)
        VALUES
          (1, 'Preliminary Design Report', 'report', '2026-07-31', 'A', 'issued_for_construction'),
          (1, 'Construction Drawings — Roadway', 'drawing', '2026-08-31', 'B', 'client_review'),
          (2, 'Structural Analysis and Calculations', 'calculation', '2026-09-15', 'A', 'internal_review'),
          (2, 'Foundation Design Report', 'report', '2026-10-31', 'A', 'pending'),
          (5, 'Hydrological Assessment', 'assessment', '2026-08-15', 'A', 'approved'),
          (5, 'Stormwater Management Report', 'report', '2026-09-30', 'A', 'client_review')
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
      const { searchParams } = new URL(req.url);
      const mode = searchParams.get('mode');

      if (mode === 'dashboard') {
        const [activeProj, contractVal, delsDue, stampJobs] = await Promise.all([
          client.query(`SELECT COUNT(*) AS cnt FROM engineering_project WHERE status NOT IN ('proposal','closeout','invoiced','closed')`),
          client.query(`SELECT COALESCE(SUM(contract_value),0) AS total FROM engineering_project WHERE status NOT IN ('proposal','closed')`),
          client.query(`SELECT COUNT(*) AS cnt FROM engineering_deliverable WHERE status NOT IN ('approved','issued_for_construction') AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+14`),
          client.query(`SELECT COUNT(*) AS cnt FROM engineering_project WHERE pe_stamp_required=true AND status NOT IN ('closeout','invoiced','closed')`),
        ]);
        return Response.json({
          activeProjects: Number(activeProj.rows[0].cnt),
          totalContractValue: Number(contractVal.rows[0].total),
          deliverablesDue14d: Number(delsDue.rows[0].cnt),
          stampJobs: Number(stampJobs.rows[0].cnt),
        });
      }

      const { rows } = await client.query(`
        SELECT ec.*, COUNT(ep.id) AS project_count
        FROM engineering_client ec
        LEFT JOIN engineering_project ep ON ep.client_id=ec.id AND ep.status NOT IN ('closed','invoiced')
        GROUP BY ec.id ORDER BY ec.name
      `);
      return Response.json({ clients: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('engineering-consultant GET error:', err);
    return Response.json({ error: 'Failed to fetch data.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });
  try {
    await ensureTables();
    const body = await req.json().catch(() => null);
    if (!body?.name) return Response.json({ error: 'name is required.' }, { status: 400 });
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO engineering_client (name, contact_person, email, phone, company_type, city, province, engineering_discipline, credit_terms, preferred_contact, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [body.name, body.contact_person, body.email, body.phone, body.company_type, body.city ?? 'Calgary', body.province ?? 'AB', body.engineering_discipline, body.credit_terms ?? 30, body.preferred_contact, body.notes]
      );
      return Response.json({ client: rows[0] }, { status: 201 });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('engineering-consultant POST error:', err);
    return Response.json({ error: 'Failed to create client.' }, { status: 500 });
  }
}
