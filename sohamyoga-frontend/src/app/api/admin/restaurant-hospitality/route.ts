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
      CREATE TABLE IF NOT EXISTS rh_location (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        phone TEXT, email TEXT, cuisine_type TEXT,
        seating_capacity INT, patio_capacity INT DEFAULT 0,
        hours_of_operation JSONB DEFAULT '{}',
        pos_system TEXT,
        liquor_license TEXT, liquor_license_expiry DATE,
        health_inspection_date DATE, health_inspection_score INT,
        status TEXT DEFAULT 'open',
        manager_name TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rh_reservation (
        id SERIAL PRIMARY KEY, location_id INT REFERENCES rh_location(id),
        guest_name TEXT NOT NULL, phone TEXT, email TEXT,
        party_size INT NOT NULL, reservation_date DATE NOT NULL,
        reservation_time TIME NOT NULL, duration_minutes INT DEFAULT 90,
        table_number TEXT, section TEXT,
        status TEXT DEFAULT 'confirmed',
        special_requests TEXT, occasion TEXT,
        source TEXT DEFAULT 'phone',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rh_menu_item (
        id SERIAL PRIMARY KEY, location_id INT REFERENCES rh_location(id),
        name TEXT NOT NULL, category TEXT NOT NULL,
        description TEXT, price NUMERIC(8,2),
        food_cost NUMERIC(8,2), food_cost_pct NUMERIC(5,2),
        allergens TEXT[], dietary TEXT[],
        is_available BOOLEAN DEFAULT true, is_featured BOOLEAN DEFAULT false,
        calories INT, prep_time_minutes INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rh_supplier (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT,
        contact_name TEXT, phone TEXT, email TEXT,
        payment_terms INT DEFAULT 30,
        delivery_days TEXT[],
        min_order_amount NUMERIC(8,2),
        status TEXT DEFAULT 'active',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS rh_staff (
        id SERIAL PRIMARY KEY, location_id INT REFERENCES rh_location(id),
        name TEXT NOT NULL, role TEXT NOT NULL,
        employment_type TEXT DEFAULT 'part_time',
        hourly_rate NUMERIC(6,2), sin_last4 TEXT,
        status TEXT DEFAULT 'active',
        start_date DATE, food_safe_expiry DATE, serving_it_right_expiry DATE,
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM rh_location`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO rh_location (name, address, city, province, phone, email, cuisine_type, seating_capacity, patio_capacity, pos_system, liquor_license, liquor_license_expiry, health_inspection_date, health_inspection_score, status, manager_name, hours_of_operation) VALUES
        ('Maplewood Bistro','1224 17 Ave SW','Calgary','AB','403-555-1001','info@maplewoodbistro.ca','Canadian Contemporary',85,30,'Toast','L-AB-1234567','2027-03-31','2026-07-15',91,'open','Jennifer Walsh','{"mon":"11am-10pm","tue":"11am-10pm","wed":"11am-10pm","thu":"11am-11pm","fri":"11am-12am","sat":"10am-12am","sun":"10am-9pm"}'),
        ('Spice Route Kitchen','880 Centre St N','Calgary','AB','403-555-1002','hello@spiceroute.ca','South Asian Fusion',65,0,'Lightspeed','L-AB-7654321','2026-11-30','2026-04-22',87,'open','Raj Patel','{"mon":"closed","tue":"11am-9:30pm","wed":"11am-9:30pm","thu":"11am-9:30pm","fri":"11am-10pm","sat":"11am-10pm","sun":"12pm-9pm"}'),
        ('The Hideout Pub','4120 Bow Trail SW','Calgary','AB','403-555-1003','info@hideoutpub.ca','Pub & Grill',120,45,'Square','L-AB-9988776','2026-09-30','2026-01-30',83,'open','Mike Donahue','{"mon":"11am-2am","tue":"11am-2am","wed":"11am-2am","thu":"11am-2am","fri":"11am-3am","sat":"11am-3am","sun":"11am-12am"}')
      `);
      await client.query(`
        INSERT INTO rh_reservation (location_id, guest_name, phone, email, party_size, reservation_date, reservation_time, duration_minutes, table_number, section, status, special_requests, occasion, source) VALUES
        (1,'Smith Party','403-555-2001','smith@email.ca',4,CURRENT_DATE,'18:30:00',90,'12','Main','confirmed','Window seat preferred','Birthday','opentable'),
        (1,'Chen Family','403-555-2002','chen@gmail.com',6,CURRENT_DATE,'19:00:00',120,'T5','Main','confirmed','Nut allergy — guest 1',NULL,'phone'),
        (1,'Johnson, 2','403-555-2003',NULL,2,CURRENT_DATE,'20:00:00',60,'Bar-2','Bar','confirmed',NULL,'Anniversary','website'),
        (2,'Patel Group','403-555-2004','patel@corp.ca',8,CURRENT_DATE,'12:00:00',90,'Private-1','Private','confirmed','Vegetarian options needed','Corporate lunch','phone'),
        (1,'Williams','403-555-2005',NULL,3,CURRENT_DATE + 1,'18:00:00',75,'9','Patio','confirmed',NULL,NULL,'walk_in'),
        (3,'McCarthy Party','403-555-2006','mccarthy@email.ca',10,CURRENT_DATE,'19:30:00',120,'T10','Main','confirmed','Bar tab requested',NULL,'phone')
      `);
      await client.query(`
        INSERT INTO rh_menu_item (location_id, name, category, description, price, food_cost, food_cost_pct, allergens, dietary, is_available, is_featured, calories, prep_time_minutes) VALUES
        (1,'Wild Mushroom Risotto','main','Arborio rice, wild mushroom medley, truffle oil, parmesan',28.00,7.20,25.7,ARRAY['dairy','gluten'],ARRAY['vegetarian'],true,true,680,18),
        (1,'BC Salmon','main','Pan-seared BC salmon, asparagus, lemon beurre blanc',34.00,11.90,35.0,ARRAY['dairy','shellfish'],ARRAY['gluten_free'],true,true,520,14),
        (1,'Beef Tenderloin','main','6oz AAA Alberta beef, truffle frites, red wine jus',52.00,16.64,32.0,ARRAY['dairy','gluten'],ARRAY[],true,false,720,20),
        (1,'Charcuterie Board','appetizer','Cured meats, imported cheese, pickles, house crackers',24.00,8.16,34.0,ARRAY['dairy','gluten'],ARRAY[],true,true,NULL,8),
        (1,'Classic Caesar','salad','Romaine, house dressing, parmesan, house-made croutons',16.00,3.20,20.0,ARRAY['dairy','gluten','eggs'],ARRAY[],true,false,320,5),
        (1,'Craft Lager','beer','Local Prairie Giant Brewing 500ml',9.00,2.25,25.0,ARRAY['gluten'],ARRAY[],true,false,NULL,1),
        (2,'Butter Chicken','main','House slow-cooked chicken, basmati, naan, raita',22.00,5.72,26.0,ARRAY['dairy','gluten'],ARRAY[],true,true,680,12),
        (2,'Paneer Tikka Masala','main','Cottage cheese, spiced tomato-cream sauce, basmati',20.00,4.80,24.0,ARRAY['dairy'],ARRAY['vegetarian','gluten_free'],true,true,540,12),
        (2,'Dal Makhani','main','Slow-cooked black lentils, cream, ginger',18.00,3.06,17.0,ARRAY['dairy'],ARRAY['vegetarian','gluten_free'],true,false,480,10),
        (3,'Burger & Fries','main','6oz Alberta beef patty, brioche, house sauce, fries',19.00,6.65,35.0,ARRAY['gluten','dairy'],ARRAY[],true,true,920,12),
        (3,'Fish & Chips','main','2-piece beer-battered cod, fries, coleslaw, tartar',22.00,7.26,33.0,ARRAY['gluten','eggs','shellfish'],ARRAY[],true,true,1100,14),
        (3,'Pint of Guinness','beer','Draught 568ml',9.50,2.85,30.0,ARRAY['gluten'],ARRAY[],true,false,NULL,2)
      `);
      await client.query(`
        INSERT INTO rh_supplier (name, category, contact_name, phone, email, payment_terms, delivery_days, min_order_amount, status, notes) VALUES
        ('Fresh Fields Produce','produce','Kim Tanaka','403-555-3001','kim@freshfields.ca',14,ARRAY['mon','wed','fri'],150.00,'active','Organic options available'),
        ('Alberta Prime Meats','meat','Dave Kowalski','403-555-3002','dave@abprime.ca',30,ARRAY['tue','thu','sat'],500.00,'active','AAA certified, whole beef orders min 1 week notice'),
        ('Pacific Seafood Calgary','seafood','Sarah Lee','403-555-3003','sarah@pacificseafood.ca',21,ARRAY['mon','wed','fri'],250.00,'active','Next-day air freight from Vancouver'),
        ('Sysco Canada West','dry_goods','Mark Johnson','403-555-3004','mark.j@sysco.ca',30,ARRAY['mon','tue','wed','thu','fri'],300.00,'active','Weekly standing order'),
        ('Beverage World AB','beverages','Tom Reynolds','403-555-3005','tom@beverageworld.ca',30,ARRAY['wed'],200.00,'active','Beer, spirits, mixers, NA beverages'),
        ('Ecolab Foodservice','cleaning','N/A','403-555-3006','orders@ecolab.ca',30,ARRAY['mon'],150.00,'active','Sanitizer, dishwash chemicals, pest control')
      `);
      await client.query(`
        INSERT INTO rh_staff (location_id, name, role, employment_type, hourly_rate, status, start_date, food_safe_expiry, serving_it_right_expiry) VALUES
        (1,'Emma Wilson','head_chef','full_time',36.00,'active','2024-03-01','2028-03-01',NULL),
        (1,'Carlos Mendez','sous_chef','full_time',26.00,'active','2024-06-15','2027-06-15',NULL),
        (1,'Lisa Park','server','part_time',17.50,'active','2025-01-10','2026-11-30','2027-01-10'),
        (1,'Ryan O''Brien','server','part_time',17.50,'active','2025-03-01','2026-09-30','2026-10-01'),
        (1,'Aisha Mohammed','bartender','full_time',20.00,'active','2024-09-01','2027-09-01','2027-09-01'),
        (2,'Priya Sharma','head_chef','full_time',34.00,'active','2023-11-01','2027-11-01',NULL),
        (2,'Ali Hassan','server','part_time',17.50,'active','2025-05-01','2027-05-01','2027-05-01'),
        (3,'Tom Brady','manager','full_time',28.00,'active','2022-08-01','2027-08-01','2027-08-01'),
        (3,'Casey Wong','bartender','full_time',19.00,'active','2023-04-15','2026-10-15','2026-10-15'),
        (3,'Nicole Tremblay','server','casual',17.50,'active','2025-09-01','2026-09-30','2027-01-01')
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
      const today = new Date().toISOString().slice(0, 10);
      const [todayRes, locations, foodCost, certAlerts] = await Promise.all([
        client.query(`SELECT COUNT(*) AS count, COALESCE(SUM(party_size),0) AS covers FROM rh_reservation WHERE reservation_date = $1 AND status NOT IN ('cancelled','no_show')`, [today]),
        client.query(`SELECT id, name, status, health_inspection_date, health_inspection_score, liquor_license_expiry FROM rh_location`),
        client.query(`SELECT ROUND(AVG(food_cost_pct),1) AS avg_pct, COUNT(*) FILTER (WHERE food_cost_pct > 35) AS high_cost_items FROM rh_menu_item WHERE is_available = true`),
        client.query(`SELECT COUNT(*) AS n FROM rh_staff WHERE status='active' AND (food_safe_expiry < NOW() + INTERVAL '60 days' OR serving_it_right_expiry < NOW() + INTERVAL '60 days')`),
      ]);
      return Response.json({
        todayReservations: parseInt(todayRes.rows[0].count, 10),
        coversTonight: parseInt(todayRes.rows[0].covers, 10),
        locations: locations.rows,
        avgFoodCostPct: parseFloat(foodCost.rows[0].avg_pct) || 0,
        highCostItems: parseInt(foodCost.rows[0].high_cost_items, 10),
        certAlerts: parseInt(certAlerts.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
