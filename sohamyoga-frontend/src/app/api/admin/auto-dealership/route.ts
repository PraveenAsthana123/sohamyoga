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
      CREATE TABLE IF NOT EXISTS auto_vehicle_inventory (
        id SERIAL PRIMARY KEY, stock_number TEXT UNIQUE NOT NULL,
        condition TEXT DEFAULT 'used',
        year INT, make TEXT, model TEXT, trim TEXT, body_style TEXT,
        vin TEXT UNIQUE, color_exterior TEXT, color_interior TEXT,
        mileage_km INT DEFAULT 0, engine TEXT, transmission TEXT DEFAULT 'automatic',
        drivetrain TEXT DEFAULT 'fwd',
        fuel_type TEXT DEFAULT 'gasoline',
        doors INT DEFAULT 4,
        msrp NUMERIC(10,2), asking_price NUMERIC(10,2), cost NUMERIC(10,2),
        features TEXT[], images TEXT[],
        location TEXT DEFAULT 'Calgary', lot_position TEXT,
        date_added DATE DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'available',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS auto_customer (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT,
        address TEXT, city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        date_of_birth DATE, sin_last4 TEXT,
        credit_tier TEXT,
        employment_type TEXT, annual_income NUMERIC(10,2),
        source TEXT,
        status TEXT DEFAULT 'active', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS auto_deal (
        id SERIAL PRIMARY KEY, customer_id INT REFERENCES auto_customer(id),
        vehicle_id INT REFERENCES auto_vehicle_inventory(id),
        deal_type TEXT DEFAULT 'retail',
        salesperson TEXT, finance_manager TEXT,
        sale_price NUMERIC(10,2), trade_in_value NUMERIC(10,2), trade_in_vehicle TEXT,
        down_payment NUMERIC(10,2), rebates NUMERIC(8,2),
        gst NUMERIC(8,2),
        total_financed NUMERIC(10,2),
        lender TEXT,
        interest_rate NUMERIC(6,3), term_months INT, monthly_payment NUMERIC(8,2),
        extended_warranty BOOLEAN DEFAULT false, extended_warranty_cost NUMERIC(8,2),
        gap_insurance BOOLEAN DEFAULT false, gap_cost NUMERIC(6,2),
        paint_protection BOOLEAN DEFAULT false, protection_cost NUMERIC(6,2),
        status TEXT DEFAULT 'pending',
        delivery_date DATE,
        front_gross NUMERIC(10,2),
        back_gross NUMERIC(10,2),
        total_gross NUMERIC(10,2),
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS auto_service_appointment (
        id SERIAL PRIMARY KEY, customer_id INT REFERENCES auto_customer(id),
        vehicle_stock INT,
        customer_vehicle TEXT,
        service_type TEXT,
        description TEXT, advisor TEXT,
        appointment_date DATE NOT NULL, appointment_time TIME,
        status TEXT DEFAULT 'scheduled',
        labour_hours NUMERIC(5,2), labour_rate NUMERIC(6,2) DEFAULT 145,
        parts_cost NUMERIC(8,2), shop_supplies NUMERIC(6,2),
        total_invoice NUMERIC(10,2),
        loaner_vehicle TEXT,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM auto_vehicle_inventory`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO auto_vehicle_inventory (stock_number, condition, year, make, model, trim, body_style, vin, color_exterior, color_interior, mileage_km, engine, transmission, drivetrain, fuel_type, doors, msrp, asking_price, cost, features, location, lot_position, date_added, status)
        VALUES
          ('A2401','new',2024,'Toyota','RAV4','XLE','SUV','2T3BFREV4RW123401','Ice Cap White','Black',0,'2.5L 4-cyl','automatic','awd','gasoline',4,41995,41995,36800,ARRAY['heated seats','apple carplay','lane assist'],'Calgary','A1',CURRENT_DATE - 15,'available'),
          ('U2301','used',2021,'Honda','Civic','Sport','Sedan','2HGFC2F87MH123301','Sonic Grey Pearl','Black',42000,'1.5L Turbo','automatic','fwd','gasoline',4,NULL,24900,18500,ARRAY['remote start','heated seats','backup camera'],'Calgary','B3',CURRENT_DATE - 45,'available'),
          ('C2201','certified_pre_owned',2022,'Ford','F-150','XLT','Pickup','1FTFW1E88NFB12201','Agate Black','Medium Dark Slate',28000,'2.7L EcoBoost','automatic','4wd','gasoline',4,NULL,52900,44000,ARRAY['tow package','sync 4','pro trailer backup'],'Calgary','C2',CURRENT_DATE - 72,'available'),
          ('A2402','new',2024,'Chevrolet','Equinox','LT','SUV','3GNAXUEV3RS234502','Mosaic Black','Jet Black',0,'1.5L Turbo','automatic','fwd','gasoline',4,37995,37995,33200,ARRAY['wireless charging','teen driver','surround vision'],'Calgary','A2',CURRENT_DATE - 8,'available'),
          ('U2302','used',2020,'Mazda','CX-5','GT','SUV','JM3KFADM2L0823302','Soul Red Crystal','Black Leather',61000,'2.5L Turbo','automatic','awd','gasoline',4,NULL,31500,24800,ARRAY['bose audio','head-up display','360 cam'],'Calgary','B7',CURRENT_DATE - 93,'available');
        INSERT INTO auto_customer (name, email, phone, city, province, credit_tier, employment_type, annual_income, source, status)
        VALUES
          ('Michael Tran','mtran@email.ca','403-555-0101','Calgary','AB','A','employed',95000,'internet','active'),
          ('Sarah Johnson','sarah.j@email.ca','403-555-0202','Calgary','AB','B','self_employed',72000,'referral','active'),
          ('David Park','dpark@email.ca','403-555-0303','Airdrie','AB','A','employed',145000,'walk_in','active');
        INSERT INTO auto_service_appointment (customer_vehicle, service_type, description, advisor, appointment_date, appointment_time, status, labour_hours, labour_rate, parts_cost)
        VALUES
          ('2020 Toyota Camry','oil_change','Synthetic oil change + tire rotation','Mike Chen',CURRENT_DATE,'09:00','scheduled',0.5,145,45),
          ('2019 Honda CR-V','brake_inspection','Customer reports grinding noise on braking','Mike Chen',CURRENT_DATE,'10:30','arrived',1.5,145,0),
          ('2022 Ford F-150','general_repair','Check engine light — P0171 lean code','Sarah Liu',CURRENT_DATE,'13:00','in_service',2.0,145,120);
      `);
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureTables();
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [invRes, dealsRes, serviceRes, agingRes] = await Promise.all([
        client.query(`
          SELECT condition, COUNT(*) AS cnt, SUM(asking_price) AS total_value
          FROM auto_vehicle_inventory WHERE status = 'available'
          GROUP BY condition ORDER BY condition
        `),
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW())) AS deals_this_month,
            COALESCE(SUM(total_gross) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW())), 0) AS gross_this_month,
            COALESCE(SUM(front_gross) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW())), 0) AS front_this_month,
            COALESCE(SUM(back_gross) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', NOW())), 0) AS back_this_month
          FROM auto_deal WHERE status IN ('funded','delivered')
        `),
        client.query(`
          SELECT COUNT(*) AS today_service,
            COALESCE(SUM(total_invoice), 0) AS service_revenue_today
          FROM auto_service_appointment
          WHERE appointment_date = CURRENT_DATE
        `),
        client.query(`
          SELECT COUNT(*) FILTER (WHERE CURRENT_DATE - date_added > 60) AS over_60,
            COUNT(*) FILTER (WHERE CURRENT_DATE - date_added > 90) AS over_90,
            COUNT(*) FILTER (WHERE CURRENT_DATE - date_added > 120) AS over_120
          FROM auto_vehicle_inventory WHERE status = 'available'
        `),
      ]);
      return Response.json({
        inventory_by_condition: invRes.rows,
        deals: dealsRes.rows[0],
        service: serviceRes.rows[0],
        aging: agingRes.rows[0],
      });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
