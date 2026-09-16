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
      CREATE TABLE IF NOT EXISTS tl_vehicle (
        id SERIAL PRIMARY KEY, unit_number TEXT NOT NULL, type TEXT NOT NULL,
        make TEXT, model TEXT, year INT, vin TEXT UNIQUE,
        license_plate TEXT, province TEXT DEFAULT 'AB',
        gross_vehicle_weight_rating INT,
        status TEXT DEFAULT 'active',
        current_driver_id INT, odometer_km INT DEFAULT 0,
        fuel_type TEXT DEFAULT 'diesel',
        insurance_expiry DATE, registration_expiry DATE, safety_cert_expiry DATE,
        next_maintenance_km INT, last_maintenance_date DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tl_driver (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        license_number TEXT, license_class TEXT DEFAULT 'Class 1',
        license_expiry DATE, abstract_date DATE,
        medical_expiry DATE,
        status TEXT DEFAULT 'active',
        employment_type TEXT DEFAULT 'employee',
        base_city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        hourly_rate NUMERIC(8,2), per_km_rate NUMERIC(6,4), per_load_rate NUMERIC(8,2),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tl_load (
        id SERIAL PRIMARY KEY, load_number TEXT NOT NULL,
        vehicle_id INT REFERENCES tl_vehicle(id), driver_id INT REFERENCES tl_driver(id),
        shipper_name TEXT, consignee_name TEXT,
        origin_city TEXT, origin_province TEXT, origin_postal TEXT,
        destination_city TEXT, destination_province TEXT, destination_postal TEXT,
        commodity TEXT, weight_kg NUMERIC(10,2), pieces INT,
        hazmat BOOLEAN DEFAULT false, hazmat_class TEXT,
        pickup_date DATE, delivery_date DATE, actual_delivery DATE,
        distance_km NUMERIC(8,2),
        rate NUMERIC(10,2), fuel_surcharge NUMERIC(8,2), accessorials NUMERIC(8,2),
        total_revenue NUMERIC(10,2),
        driver_pay NUMERIC(10,2),
        status TEXT DEFAULT 'pending',
        bol_number TEXT, po_number TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tl_maintenance (
        id SERIAL PRIMARY KEY, vehicle_id INT REFERENCES tl_vehicle(id),
        maintenance_type TEXT, description TEXT, odometer_km INT, cost NUMERIC(8,2),
        vendor TEXT, work_order TEXT,
        maintenance_date DATE DEFAULT CURRENT_DATE,
        next_due_date DATE, next_due_km INT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed if empty
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM tl_vehicle`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO tl_vehicle (unit_number, type, make, model, year, vin, license_plate, province, gross_vehicle_weight_rating, status, odometer_km, fuel_type, insurance_expiry, registration_expiry, safety_cert_expiry, next_maintenance_km) VALUES
        ('TRK-001','semi_truck','Kenworth','T680',2021,'1XKWDB9X0MJ123456','AB 12345','AB',36287,'active',456000,'diesel','2027-03-31','2026-11-30','2026-12-15',460000),
        ('TRK-002','semi_truck','Peterbilt','579',2020,'1XP5DB9X9ND654321','AB 23456','AB',36287,'active',612000,'diesel','2026-10-15','2026-09-30','2026-10-01',615000),
        ('VAN-001','van','Ford','Transit 350',2022,'1FTBF2XG0NKA78901','AB 34567','AB',4536,'active',87000,'gas','2027-06-30','2027-01-31','2027-02-28',92000),
        ('TRL-001','trailer','Utility','4000D-X',2019,'1UYVS2530KU112233','AB 45678','AB',NULL,'active',NULL,'diesel',NULL,'2026-12-31',NULL,NULL),
        ('TRK-003','straight_truck','International','MV607',2018,'3HAMMNAR2JL987654','AB 56789','AB',11793,'maintenance',234000,'diesel','2027-01-31','2027-03-31','2026-09-30',236000)
      `);
      await client.query(`
        INSERT INTO tl_driver (name, email, phone, license_number, license_class, license_expiry, abstract_date, medical_expiry, status, employment_type, base_city, hourly_rate, per_km_rate) VALUES
        ('Mike Kowalski','mike.k@alhauling.ca','403-555-0101','AB-CL1-123456','Class 1','2027-08-31','2026-01-15','2027-02-28','active','employee','Calgary',28.50,0.0650),
        ('Sarah Tran','sarah.t@alhauling.ca','403-555-0202','AB-CL1-234567','Class 1','2026-11-30','2025-09-20','2026-10-15','active','owner_operator','Edmonton',NULL,0.0820),
        ('Dale Friesen','dale.f@alhauling.ca','403-555-0303','AB-CL3-345678','Class 3','2027-04-30','2026-03-10','2027-01-31','active','employee','Calgary',24.00,NULL),
        ('Rosa Delgado','rosa.d@alhauling.ca','403-555-0404','AB-CL1-456789','Class 1','2026-09-30','2025-12-05','2026-08-31','active','contractor','Red Deer',NULL,0.0750)
      `);
      await client.query(`
        INSERT INTO tl_load (load_number, vehicle_id, driver_id, shipper_name, consignee_name, origin_city, origin_province, destination_city, destination_province, commodity, weight_kg, pieces, pickup_date, delivery_date, distance_km, rate, fuel_surcharge, total_revenue, driver_pay, status, bol_number) VALUES
        ('L-2026-001',1,1,'Prairie Grains Co.','Manitoba Mills','Calgary','AB','Winnipeg','MB','Wheat — Grade 2',24500,1,'2026-09-10','2026-09-13',1339.00,2850.00,285.00,3135.00,980.00,'delivered','BOL-2026-001'),
        ('L-2026-002',2,2,'Syncrude Canada','Brock Solutions','Fort McMurray','AB','Edmonton','AB','Industrial Supplies',8200,42,'2026-09-14','2026-09-15',455.00,1200.00,120.00,1320.00,520.00,'in_transit','BOL-2026-002'),
        ('L-2026-003',1,1,'Fresh Produce Inc.','Superstore DC','Lethbridge','AB','Calgary','AB','Mixed Produce — Refrigerated',16000,210,'2026-09-16','2026-09-16',216.00,850.00,85.00,935.00,310.00,'assigned','BOL-2026-003'),
        ('L-2026-004',3,3,'Home Depot Canada','Home Depot Store 7032','Calgary','AB','Red Deer','AB','Building Materials',6500,88,'2026-09-17','2026-09-17',148.00,480.00,48.00,528.00,180.00,'pending',NULL)
      `);
      await client.query(`
        INSERT INTO tl_maintenance (vehicle_id, maintenance_type, description, odometer_km, cost, vendor, maintenance_date, next_due_date, next_due_km, status) VALUES
        (1,'oil_change','15W-40 diesel engine oil change + filter',452000,385.00,'Kenworth Calgary Service','2026-08-20','2027-02-20',467000,'completed'),
        (2,'tire','Steer axle tires x2 replaced — Michelin X Line Energy D',608000,1840.00,'TA Truck Service','2026-09-01','2027-03-01',708000,'completed'),
        (5,'annual_safety','Annual Alberta Safety Inspection — FAILED: brake adjustment required',233500,920.00,'TransAlta Truck Repair','2026-09-10',NULL,NULL,'completed'),
        (5,'brake','Brake adjustment — all axles — post-safety-inspection fix',233600,420.00,'TransAlta Truck Repair','2026-09-12',NULL,NULL,'completed')
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
      const [vehicleStats, loadStats, revenueToday, revenueWeek, complianceAlerts] = await Promise.all([
        client.query(`SELECT status, COUNT(*) AS n FROM tl_vehicle GROUP BY status`),
        client.query(`SELECT status, COUNT(*) AS n FROM tl_load GROUP BY status`),
        client.query(`SELECT COALESCE(SUM(total_revenue),0) AS v FROM tl_load WHERE status IN ('delivered','invoiced','paid') AND actual_delivery = CURRENT_DATE`),
        client.query(`SELECT COALESCE(SUM(total_revenue),0) AS v FROM tl_load WHERE status IN ('delivered','invoiced','paid') AND actual_delivery >= CURRENT_DATE - INTERVAL '7 days'`),
        client.query(`
          SELECT COUNT(*) AS n FROM (
            SELECT id FROM tl_vehicle WHERE insurance_expiry < NOW() + INTERVAL '60 days' OR registration_expiry < NOW() + INTERVAL '60 days' OR safety_cert_expiry < NOW() + INTERVAL '60 days'
            UNION ALL
            SELECT id FROM tl_driver WHERE license_expiry < NOW() + INTERVAL '60 days' OR medical_expiry < NOW() + INTERVAL '60 days'
          ) t
        `),
      ]);
      const vs: Record<string, number> = {};
      for (const r of vehicleStats.rows) vs[r.status] = parseInt(r.n, 10);
      const ls: Record<string, number> = {};
      for (const r of loadStats.rows) ls[r.status] = parseInt(r.n, 10);
      return Response.json({ vehicleStats: vs, loadStats: ls, revenueToday: parseFloat(revenueToday.rows[0].v), revenueWeek: parseFloat(revenueWeek.rows[0].v), complianceAlerts: parseInt(complianceAlerts.rows[0].n, 10) });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const body = await req.json();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `INSERT INTO tl_load (load_number,vehicle_id,driver_id,shipper_name,consignee_name,origin_city,origin_province,origin_postal,destination_city,destination_province,destination_postal,commodity,weight_kg,pieces,hazmat,hazmat_class,pickup_date,delivery_date,distance_km,rate,fuel_surcharge,accessorials,total_revenue,driver_pay,status,bol_number,po_number,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) RETURNING *`,
        [body.load_number,body.vehicle_id||null,body.driver_id||null,body.shipper_name,body.consignee_name,body.origin_city,body.origin_province,body.origin_postal,body.destination_city,body.destination_province,body.destination_postal,body.commodity,body.weight_kg,body.pieces,body.hazmat||false,body.hazmat_class,body.pickup_date,body.delivery_date,body.distance_km,body.rate,body.fuel_surcharge,body.accessorials,body.total_revenue,body.driver_pay,body.status||'pending',body.bol_number,body.po_number,body.notes]
      );
      return Response.json(rows[0], { status: 201 });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
