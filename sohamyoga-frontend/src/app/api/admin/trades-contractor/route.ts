import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_client (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        client_type TEXT DEFAULT 'residential',
        source TEXT,
        status TEXT DEFAULT 'active', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trade_job (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES trade_client(id) ON DELETE CASCADE,
        job_number TEXT, title TEXT NOT NULL,
        trade_type TEXT NOT NULL,
        description TEXT, scope_of_work TEXT,
        address TEXT, city TEXT DEFAULT 'Calgary',
        status TEXT DEFAULT 'estimate',
        priority TEXT DEFAULT 'normal',
        start_date DATE, end_date DATE, actual_start DATE, actual_end DATE,
        estimate_amount NUMERIC(10,2), quoted_amount NUMERIC(10,2),
        material_cost NUMERIC(10,2), labour_cost NUMERIC(10,2),
        subcontractor_cost NUMERIC(10,2), overhead NUMERIC(8,2),
        invoiced_amount NUMERIC(10,2), paid_amount NUMERIC(10,2),
        permit_required BOOLEAN DEFAULT false, permit_number TEXT, permit_date DATE,
        assigned_workers TEXT[], lead_worker TEXT,
        warranty_months INT DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trade_quote (
        id SERIAL PRIMARY KEY, client_id INT REFERENCES trade_client(id),
        job_id INT REFERENCES trade_job(id),
        title TEXT NOT NULL, trade_type TEXT,
        line_items JSONB DEFAULT '[]',
        subtotal NUMERIC(10,2), gst NUMERIC(8,2), total NUMERIC(10,2),
        valid_until DATE, terms TEXT,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trade_material (
        id SERIAL PRIMARY KEY, job_id INT REFERENCES trade_job(id) ON DELETE CASCADE,
        description TEXT NOT NULL, quantity NUMERIC(8,2), unit TEXT,
        supplier TEXT, unit_cost NUMERIC(8,2), total_cost NUMERIC(8,2),
        ordered BOOLEAN DEFAULT false, received BOOLEAN DEFAULT false,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM trade_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO trade_client (name, email, phone, address, city, province, client_type, source, status) VALUES
        ('Singh Residence','preet.singh@gmail.com','403-555-0111','142 Hawkwood Blvd NW','Calgary','AB','residential','referral','active'),
        ('Bow Valley Properties Ltd.','mgr@bowvalleyprop.ca','403-555-0222','Suite 200, 620 12 Ave SW','Calgary','AB','commercial','google','active'),
        ('Chen Family Home','linda.chen@email.ca','403-555-0333','85 Cougar Ridge Dr SW','Calgary','AB','residential','kijiji','active'),
        ('Highfield Property Mgmt','ops@highfieldpm.ca','403-555-0444','1200 90 Ave SE','Calgary','AB','property_management','referral','active'),
        ('Airdrie Community Centre','admin@airdriecc.ca','403-555-0555','4000 Veterans Blvd','Airdrie','AB','commercial','google','active')
      `);
      await client.query(`
        INSERT INTO trade_job (client_id, job_number, title, trade_type, description, address, city, status, priority, start_date, end_date, estimate_amount, quoted_amount, material_cost, labour_cost, invoiced_amount, paid_amount, lead_worker, warranty_months) VALUES
        (1,'JOB-2026-001','Basement Suite Electrical Upgrade','electrical','200A panel upgrade + basement suite wiring to Alberta Electrical Code 2021','142 Hawkwood Blvd NW','Calgary','in_progress','high','2026-09-15','2026-09-22',8500.00,8500.00,2400.00,4800.00,NULL,NULL,'Mark Okafor',24),
        (2,'JOB-2026-002','Commercial HVAC Replacement','hvac','Replace 2 rooftop units — Carrier 10-ton commercial units + controls','620 12 Ave SW','Calgary','scheduled','high','2026-09-20','2026-09-24',28000.00,27500.00,18000.00,7500.00,NULL,NULL,'Dave Reyes',60),
        (3,'JOB-2026-003','Kitchen Renovation','renovation','Full kitchen renovation — cabinets, countertops, backsplash, plumbing, electrical','85 Cougar Ridge Dr SW','Calgary','completed','normal','2026-08-01','2026-08-28',32000.00,31500.00,19000.00,9500.00,31500.00,31500.00,'Sarah Kim',12),
        (4,'JOB-2026-004','Multi-unit Plumbing Inspection','plumbing','Annual plumbing inspection + water heater replacement x3 — 12-unit building','1200 90 Ave SE','Calgary','invoiced','normal','2026-09-05','2026-09-08',9200.00,9200.00,4500.00,4200.00,9200.00,NULL,'Tom Barker',12),
        (1,'JOB-2026-005','Roof Replacement Quote','roofing','Asphalt shingle replacement — 2,400 sq ft','142 Hawkwood Blvd NW','Calgary','estimate','normal',NULL,NULL,14500.00,NULL,NULL,NULL,NULL,NULL,'',10)
      `);
      await client.query(`
        INSERT INTO trade_quote (client_id, job_id, title, trade_type, line_items, subtotal, gst, total, valid_until, status) VALUES
        (5,NULL,'Community Centre HVAC Assessment + Repair','hvac','[{"description":"Site assessment + HVAC diagnostic","quantity":1,"unit":"job","unit_price":850,"total":850},{"description":"Filter replacement x8 units","quantity":8,"unit":"each","unit_price":145,"total":1160},{"description":"Coil cleaning service","quantity":4,"unit":"unit","unit_price":280,"total":1120},{"description":"Labour — 2 technicians x 8 hours","quantity":16,"unit":"hours","unit_price":110,"total":1760}]',4890.00,244.50,5134.50,'2026-10-15','sent'),
        (3,NULL,'Deck Construction — Cedar 400 sq ft','carpentry','[{"description":"Cedar decking material — 400 sq ft","quantity":400,"unit":"sq ft","unit_price":12.50,"total":5000},{"description":"Composite railing system — 60 linear ft","quantity":60,"unit":"lin ft","unit_price":85,"total":5100},{"description":"Structural framing + footings","quantity":1,"unit":"job","unit_price":3200,"total":3200},{"description":"Labour — framing + decking","quantity":80,"unit":"hours","unit_price":75,"total":6000}]',19300.00,965.00,20265.00,'2026-10-01','draft')
      `);
      await client.query(`
        INSERT INTO trade_material (job_id, description, quantity, unit, supplier, unit_cost, total_cost, ordered, received) VALUES
        (1,'200A Square D QO Panel',1,'each','Rexel Electrical Supplies',485.00,485.00,true,true),
        (1,'14/2 NMD90 Wire',500,'ft','Rexel Electrical Supplies',1.85,925.00,true,true),
        (1,'20A AFCI Breakers',12,'each','Westburne Electric',42.00,504.00,true,false),
        (2,'Carrier 10-Ton RTU Model 50XC',2,'each','Johnson Controls Canada',8400.00,16800.00,true,false),
        (2,'Programmable Thermostat Honeywell T6',2,'each','HVAC Direct',145.00,290.00,true,true)
      `);
    }
  } finally { client.release(); }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [jobsByStatus, revenue, overdue, quotesPending, materialsToOrder] = await Promise.all([
        client.query(`SELECT status, COUNT(*) AS n, COALESCE(SUM(quoted_amount),0) AS value FROM trade_job GROUP BY status`),
        client.query(`SELECT COALESCE(SUM(invoiced_amount),0) AS invoiced, COALESCE(SUM(paid_amount),0) AS paid FROM trade_job WHERE EXTRACT(MONTH FROM created_at)=EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM created_at)=EXTRACT(YEAR FROM NOW())`),
        client.query(`SELECT COUNT(*) AS n FROM trade_job WHERE status IN ('in_progress','scheduled') AND end_date < CURRENT_DATE`),
        client.query(`SELECT COUNT(*) AS n FROM trade_quote WHERE status = 'sent'`),
        client.query(`SELECT COUNT(*) AS n FROM trade_material WHERE ordered = false`),
      ]);
      const jbs: Record<string, { count: number; value: number }> = {};
      for (const r of jobsByStatus.rows) jbs[r.status] = { count: parseInt(r.n, 10), value: parseFloat(r.value) };
      return Response.json({
        jobsByStatus: jbs,
        revenueMonth: { invoiced: parseFloat(revenue.rows[0].invoiced), paid: parseFloat(revenue.rows[0].paid) },
        overdue: parseInt(overdue.rows[0].n, 10),
        quotesPending: parseInt(quotesPending.rows[0].n, 10),
        materialsToOrder: parseInt(materialsToOrder.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
