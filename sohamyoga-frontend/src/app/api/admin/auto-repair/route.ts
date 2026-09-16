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
      CREATE TABLE IF NOT EXISTS ar_customer (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT, phone TEXT NOT NULL, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        preferred_contact TEXT DEFAULT 'phone' CHECK (preferred_contact IN ('phone','email','text')),
        total_visits INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ar_vehicle (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES ar_customer(id),
        year INTEGER NOT NULL, make TEXT NOT NULL, model TEXT NOT NULL, trim TEXT,
        color TEXT, vin TEXT UNIQUE, license_plate TEXT, province TEXT DEFAULT 'AB',
        engine TEXT, transmission TEXT DEFAULT 'automatic' CHECK (transmission IN ('automatic','manual','cvt')),
        odometer_km INTEGER, fuel_type TEXT DEFAULT 'gasoline'
          CHECK (fuel_type IN ('gasoline','diesel','hybrid','electric','propane')),
        insurance_expiry DATE, registration_expiry DATE, last_service_date DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ar_work_order (
        id SERIAL PRIMARY KEY, customer_id INTEGER REFERENCES ar_customer(id),
        vehicle_id INTEGER REFERENCES ar_vehicle(id),
        wo_number TEXT UNIQUE NOT NULL,
        technician TEXT, service_advisor TEXT,
        check_in_time TIMESTAMPTZ DEFAULT NOW(), promised_time TIMESTAMPTZ,
        odometer_in INTEGER, odometer_out INTEGER,
        customer_concern TEXT NOT NULL,
        status TEXT DEFAULT 'check_in' CHECK (status IN ('check_in','diagnosis','estimate_sent','approved','in_progress','quality_check','ready','completed','invoiced','cancelled')),
        inspection_complete BOOLEAN DEFAULT false, inspection_notes TEXT,
        tire_tread_mm DECIMAL(4,1), battery_cca INTEGER, brake_pct_front INTEGER, brake_pct_rear INTEGER,
        subtotal DECIMAL(10,2) DEFAULT 0, tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0, deposit_paid DECIMAL(10,2) DEFAULT 0,
        payment_method TEXT, payment_status TEXT DEFAULT 'pending'
          CHECK (payment_status IN ('pending','partial','paid','warranty')),
        customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ar_line_item (
        id SERIAL PRIMARY KEY, work_order_id INTEGER REFERENCES ar_work_order(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK (item_type IN ('labour','part','fluid','sublet','shop_supply')),
        description TEXT NOT NULL, part_number TEXT, quantity DECIMAL(8,2) DEFAULT 1,
        unit_cost DECIMAL(10,2), unit_price DECIMAL(10,2) NOT NULL,
        labour_hours DECIMAL(5,2), technician TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','ordered','received','installed','warranty')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed sample data
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM ar_customer`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO ar_customer (first_name, last_name, email, phone, address, city, notes)
        VALUES
          ('Mike','Kowalski','mike.k@email.ca','403-555-0101','1234 Bow Trail SW','Calgary','Regular customer, prefers early morning appointments'),
          ('Sandra','Tran','sandra.t@gmail.com','403-555-0202','56 Elbow Dr SW','Calgary','Fleet account — 2 vehicles'),
          ('Dave','Okafor','dokafor@work.ca','403-555-0303','789 Memorial Dr NE','Calgary',NULL)
        RETURNING id
      `);
      const custs = await client.query(`SELECT id FROM ar_customer ORDER BY id LIMIT 3`);
      const [c1,c2,c3] = custs.rows.map((r: {id: number}) => r.id);
      await client.query(`
        INSERT INTO ar_vehicle (customer_id, year, make, model, trim, color, license_plate, engine, odometer_km, fuel_type)
        VALUES
          (${c1}, 2019, 'Ford', 'F-150', 'XLT', 'White', 'ABC-1234', '5.0L V8', 98000, 'gasoline'),
          (${c2}, 2021, 'Toyota', 'RAV4', 'Limited', 'Silver', 'DEF-5678', '2.5L 4cyl', 44000, 'hybrid'),
          (${c3}, 2017, 'Chevrolet', 'Silverado 1500', 'LT', 'Black', 'GHI-9012', '5.3L V8', 142000, 'gasoline')
        RETURNING id
      `);
      const vehs = await client.query(`SELECT id FROM ar_vehicle ORDER BY id LIMIT 3`);
      const [v1,v2,v3] = vehs.rows.map((r: {id: number}) => r.id);
      await client.query(`
        INSERT INTO ar_work_order (customer_id, vehicle_id, wo_number, technician, service_advisor, odometer_in, customer_concern, status, subtotal, tax_amount, total_amount, payment_status)
        VALUES
          (${c1}, ${v1}, 'WO-2026-0001', 'Jake Morrison', 'Lisa Park', 98000, 'Oil change + tire rotation, check brakes', 'in_progress', 185.00, 9.25, 194.25, 'pending'),
          (${c2}, ${v2}, 'WO-2026-0002', 'Carlos Rivera', 'Lisa Park', 44000, 'Hybrid battery warning light', 'diagnosis', 0, 0, 0, 'pending'),
          (${c3}, ${v3}, 'WO-2026-0003', 'Jake Morrison', 'Tom Bridger', 142000, 'Transmission slipping at highway speed', 'estimate_sent', 2400.00, 120.00, 2520.00, 'pending')
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
      const today = new Date().toISOString().slice(0,10);
      const [statusRes, readyRes, revRes, ratingRes, techRes] = await Promise.all([
        client.query(`SELECT status, COUNT(*) AS cnt FROM ar_work_order WHERE status NOT IN ('completed','invoiced','cancelled') GROUP BY status`),
        client.query(`SELECT COUNT(*) AS cnt FROM ar_work_order WHERE status='ready'`),
        client.query(`SELECT COALESCE(SUM(total_amount),0) AS rev FROM ar_work_order WHERE payment_status='paid' AND DATE(created_at)=$1`, [today]),
        client.query(`SELECT ROUND(AVG(customer_rating),1) AS avg FROM ar_work_order WHERE customer_rating IS NOT NULL AND DATE(created_at) >= DATE_TRUNC('month',CURRENT_DATE)`),
        client.query(`SELECT technician, COUNT(*) AS wo_count FROM ar_work_order WHERE status NOT IN ('completed','invoiced','cancelled') AND technician IS NOT NULL GROUP BY technician`),
      ]);
      const statusMap: Record<string, number> = {};
      statusRes.rows.forEach((r: {status: string; cnt: string}) => { statusMap[r.status] = parseInt(r.cnt); });
      return Response.json({
        work_orders_in_shop: Object.values(statusMap).reduce((a,b)=>a+b,0),
        vehicles_ready_for_pickup: parseInt(readyRes.rows[0].cnt),
        revenue_today: parseFloat(revRes.rows[0].rev),
        avg_rating_mtd: parseFloat(ratingRes.rows[0].avg) || null,
        status_breakdown: statusMap,
        technician_load: techRes.rows,
      });
    } finally { client.release(); }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
