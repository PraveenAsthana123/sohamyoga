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
      CREATE TABLE IF NOT EXISTS chef_client (
        id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, address TEXT,
        city TEXT DEFAULT 'Calgary', province TEXT DEFAULT 'AB',
        dietary_restrictions TEXT[], food_allergies TEXT[], food_preferences TEXT[],
        cuisine_preferences TEXT[], household_size INTEGER DEFAULT 2,
        service_type TEXT DEFAULT 'meal_prep'
          CHECK (service_type IN ('meal_prep','dinner_party','weekly_chef','cooking_class','event_catering','corporate_catering','private_dining')),
        frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('one_time','weekly','bi_weekly','monthly')),
        budget_per_session DECIMAL(10,2), notes TEXT,
        total_events INTEGER DEFAULT 0, total_spent DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chef_event (
        id SERIAL PRIMARY KEY, client_id INTEGER REFERENCES chef_client(id),
        event_type TEXT NOT NULL CHECK (event_type IN ('meal_prep','dinner_party','weekly_chef','cooking_class','event_catering','corporate_catering','private_dining')),
        event_date DATE NOT NULL, start_time TIME, end_time TIME,
        guest_count INTEGER DEFAULT 1, location TEXT,
        menu_theme TEXT, courses INTEGER DEFAULT 3,
        dietary_accommodations TEXT[], special_requests TEXT,
        status TEXT DEFAULT 'inquiry' CHECK (status IN ('inquiry','confirmed','shopping','prep','service','completed','cancelled')),
        chef_fee DECIMAL(10,2), grocery_estimate DECIMAL(10,2), grocery_actual DECIMAL(10,2),
        total_billed DECIMAL(10,2), deposit_paid DECIMAL(10,2) DEFAULT 0,
        payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','deposit_paid','paid','overdue')),
        client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5), client_feedback TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chef_recipe (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT
          CHECK (category IN ('appetizer','soup','salad','main_protein','main_vegetarian','side','dessert','breakfast','brunch','sauce','other')),
        cuisine TEXT, description TEXT, servings INTEGER DEFAULT 4,
        prep_time_minutes INTEGER, cook_time_minutes INTEGER,
        difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard','advanced')),
        dietary_tags TEXT[], allergens TEXT[],
        ingredients JSONB, instructions TEXT,
        cost_estimate_per_serving DECIMAL(8,2),
        is_signature BOOLEAN DEFAULT false, times_served INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chef_shopping_list (
        id SERIAL PRIMARY KEY, event_id INTEGER REFERENCES chef_event(id) ON DELETE CASCADE,
        ingredient TEXT NOT NULL, quantity TEXT, unit TEXT,
        estimated_cost DECIMAL(10,2), actual_cost DECIMAL(10,2),
        purchased BOOLEAN DEFAULT false, store TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Seed
    const { rows } = await client.query(`SELECT COUNT(*) AS n FROM chef_client`);
    if (parseInt(rows[0].n, 10) === 0) {
      await client.query(`
        INSERT INTO chef_client (first_name, last_name, email, phone, city, dietary_restrictions, food_allergies, cuisine_preferences, household_size, service_type, frequency, budget_per_session)
        VALUES
          ('Margaret','Henderson','margaret.h@email.ca','403-555-0101','Calgary',ARRAY['dairy_free'],ARRAY[]::text[],ARRAY['Mediterranean','Asian fusion'],4,'weekly_chef','weekly',350.00),
          ('Carlos','Rivera','carlos.r@email.ca','403-555-0202','Calgary',ARRAY[]::text[],ARRAY['shellfish'],ARRAY['Latin','Italian'],6,'dinner_party','monthly',600.00),
          ('Aisha','Okonkwo','aisha.o@email.ca','403-555-0303','Calgary',ARRAY['vegan'],ARRAY['tree_nuts'],ARRAY['African','Middle Eastern'],2,'meal_prep','bi_weekly',200.00),
          ('The Morrison Corp','Morrison Corporate','events@morrison.ca','403-555-0404','Calgary',ARRAY[]::text[],ARRAY[]::text[],ARRAY['International'],50,'corporate_catering','monthly',2500.00)
      `);
      await client.query(`
        INSERT INTO chef_recipe (name, category, cuisine, description, servings, prep_time_minutes, cook_time_minutes, difficulty, dietary_tags, is_signature, times_served)
        VALUES
          ('Herb-Crusted Alberta Rack of Lamb','main_protein','Canadian','Dijon mustard and herb crust on local lamb',4,20,25,'hard',ARRAY['gluten_free','dairy_free'],true,18),
          ('Butternut Squash Velouté','soup','French','Silky roasted squash soup with crème fraîche',6,15,35,'medium',ARRAY['vegetarian','gluten_free'],false,12),
          ('Saffron Risotto Milanese','main_vegetarian','Italian','Classic Milan-style risotto with bone marrow',4,10,30,'hard',ARRAY['gluten_free'],true,25),
          ('Lavender Honey Panna Cotta','dessert','Italian','Alberta honey lavender panna cotta with berry compote',6,20,5,'easy',ARRAY['vegetarian','gluten_free'],true,30),
          ('Spiced Moroccan Cauliflower','side','Moroccan','Whole roasted cauliflower with chermoula',4,10,40,'easy',ARRAY['vegan','gluten_free'],false,15)
      `);
      await client.query(`
        INSERT INTO chef_event (client_id, event_type, event_date, start_time, end_time, guest_count, location, menu_theme, courses, status, chef_fee, grocery_estimate, deposit_paid)
        VALUES
          (2,'dinner_party',CURRENT_DATE + 5,'17:00','22:00',8,'Client home - SW Calgary','Mediterranean Summer',4,'confirmed',400.00,280.00,200.00),
          (1,'weekly_chef',CURRENT_DATE + 2,'10:00','14:00',4,'Client home - NW Calgary','Healthy Week Prep',1,'confirmed',300.00,180.00,0.00),
          (4,'corporate_catering',CURRENT_DATE + 14,'11:00','13:00',50,'Morrison Corp HQ','Lunch Buffet',1,'inquiry',800.00,600.00,0.00)
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
      const [eventsMonth, upcoming, revenue, rating, signatures] = await Promise.all([
        client.query(`SELECT COUNT(*) AS n FROM chef_event WHERE DATE_TRUNC('month',event_date::timestamptz)=DATE_TRUNC('month',NOW()) AND status NOT IN ('cancelled')`),
        client.query(`SELECT COUNT(*) AS n FROM chef_event WHERE event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND status NOT IN ('cancelled','completed')`),
        client.query(`SELECT COALESCE(SUM(total_billed),0) AS rev FROM chef_event WHERE DATE_TRUNC('month',event_date::timestamptz)=DATE_TRUNC('month',NOW()) AND status='completed'`),
        client.query(`SELECT ROUND(AVG(client_rating),1) AS avg_r FROM chef_event WHERE client_rating IS NOT NULL`),
        client.query(`SELECT COUNT(*) AS n FROM chef_recipe WHERE is_signature=true`),
      ]);
      return Response.json({
        events_this_month: parseInt(eventsMonth.rows[0].n, 10),
        upcoming_events_7d: parseInt(upcoming.rows[0].n, 10),
        revenue_mtd: parseFloat(revenue.rows[0].rev),
        avg_rating: parseFloat(rating.rows[0].avg_r) || 0,
        signature_recipes_count: parseInt(signatures.rows[0].n, 10),
      });
    } finally { client.release(); }
  } catch (e: unknown) { return Response.json({ error: String(e) }, { status: 500 }); }
}
