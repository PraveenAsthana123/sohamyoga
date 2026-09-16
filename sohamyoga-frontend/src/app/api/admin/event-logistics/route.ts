export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`CREATE TABLE IF NOT EXISTS event_venues (
    id SERIAL PRIMARY KEY, event_name TEXT, venue_name TEXT, address TEXT, capacity INTEGER DEFAULT 0,
    inspection_date DATE, inspection_status TEXT DEFAULT 'pending', inspection_notes TEXT,
    approved BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS event_logistics_items (
    id SERIAL PRIMARY KEY, event_name TEXT, category TEXT, item_name TEXT, quantity INTEGER DEFAULT 1,
    supplier TEXT, cost NUMERIC DEFAULT 0, status TEXT DEFAULT 'pending', delivery_date DATE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS event_attendees (
    id SERIAL PRIMARY KEY, event_name TEXT, name TEXT, email TEXT, company TEXT,
    badge_type TEXT DEFAULT 'general', checked_in BOOLEAN DEFAULT FALSE, check_in_time TIMESTAMPTZ,
    lead_score INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS event_gamification (
    id SERIAL PRIMARY KEY, event_name TEXT, challenge_name TEXT, points INTEGER DEFAULT 10,
    completions INTEGER DEFAULT 0, badge_name TEXT, status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS event_emergency_plans (
    id SERIAL PRIMARY KEY, event_name TEXT, scenario TEXT, response_steps JSONB,
    responsible_person TEXT, contact TEXT, last_reviewed DATE, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await client.query(`CREATE TABLE IF NOT EXISTS event_awards (
    id SERIAL PRIMARY KEY, event_name TEXT, category TEXT, winner_name TEXT,
    runner_up TEXT, presented_by TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows } = await client.query('SELECT COUNT(*) FROM event_venues');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`INSERT INTO event_venues (event_name, venue_name, address, capacity, inspection_date, inspection_status, inspection_notes, approved) VALUES
      ('Yoga Summit 2026','The Grand Wellness Centre','100 King St W, Toronto, ON',350,'2026-09-01','approved','Excellent facilities. AV system tested and working. Breakout rooms configured. Catering kitchen available. Parking for 200 vehicles.',true),
      ('Corporate Wellness Day','RBC Convention Centre','2 Harbour St, Toronto, ON',500,'2026-09-10','in_progress','Initial walkthrough complete. Waiting for AV test and emergency exit confirmation.',false)
    `);
    await client.query(`INSERT INTO event_attendees (event_name, name, email, company, badge_type, checked_in, check_in_time, lead_score) VALUES
      ('Yoga Summit 2026','Sarah Johnson','sarah.j@wellness.co','Wellness Co','VIP',true,'2026-09-15 08:30:00',92),
      ('Yoga Summit 2026','Michael Chen','m.chen@fitlife.io','FitLife Inc','speaker',true,'2026-09-15 08:15:00',85),
      ('Yoga Summit 2026','Emily Rodriguez','emily.r@healthhub.ca','HealthHub Canada','general',true,'2026-09-15 09:00:00',67),
      ('Yoga Summit 2026','David Kim','david.k@mindbody.com','MindBody Corp','general',false,NULL,45),
      ('Yoga Summit 2026','Priya Sharma','priya@yogastudio.ca','Om Studio','VIP',true,'2026-09-15 08:45:00',88),
      ('Yoga Summit 2026','James Wilson','james.w@corporate.com','Global Corp','general',false,NULL,34),
      ('Yoga Summit 2026','Lisa Park','lisa.p@fitnessfirst.ca','Fitness First','sponsor',true,'2026-09-15 07:55:00',95),
      ('Corporate Wellness Day','Anna Kowalski','anna.k@techcorp.com','TechCorp Inc','general',false,NULL,52),
      ('Corporate Wellness Day','Robert Brown','r.brown@startupco.ca','Startup Co','VIP',false,NULL,78),
      ('Corporate Wellness Day','Jennifer Lee','jen.lee@medispa.ca','MediSpa Group','speaker',false,NULL,88),
      ('Yoga Summit 2026','Carlos Martinez','carlos@yogalife.mx','Yoga Life MX','general',true,'2026-09-15 09:15:00',61),
      ('Yoga Summit 2026','Aisha Patel','aisha.p@wellclub.ca','Well Club','general',false,NULL,43),
      ('Corporate Wellness Day','Thomas Anderson','t.anderson@bank.ca','Canadian Bank','general',false,NULL,37),
      ('Yoga Summit 2026','Rachel Green','rachel.g@yoga247.com','Yoga 247','general',true,'2026-09-15 09:30:00',55),
      ('Corporate Wellness Day','Mark Thompson','mark.t@hr-firm.ca','HR Solutions Inc','VIP',false,NULL,82)
    `);
    await client.query(`INSERT INTO event_logistics_items (event_name, category, item_name, quantity, supplier, cost, status, delivery_date) VALUES
      ('Yoga Summit 2026','Furniture','Chiavari Chairs',200,'Event Rentals Co',2400.00,'confirmed','2026-09-14'),
      ('Yoga Summit 2026','AV','LED Video Wall 4x3m',1,'ProAV Inc',3500.00,'confirmed','2026-09-14'),
      ('Yoga Summit 2026','Catering','Vegetarian Lunch Boxes',350,'Green Eats Catering',5250.00,'confirmed','2026-09-15'),
      ('Yoga Summit 2026','Furniture','Round Tables (60in)',25,'Event Rentals Co',625.00,'pending','2026-09-14'),
      ('Corporate Wellness Day','AV','Wireless Microphone System',4,'ProAV Inc',800.00,'ordered','2026-09-24'),
      ('Corporate Wellness Day','Signage','Event Banners 8x10ft',6,'Print Plus',1200.00,'pending','2026-09-23'),
      ('Yoga Summit 2026','Photography','Photo/Video Team',1,'Studio Click',2500.00,'confirmed','2026-09-15'),
      ('Corporate Wellness Day','Technology','Lead Retrieval Scanners',10,'EventTech',500.00,'ordered','2026-09-24')
    `);
    await client.query(`INSERT INTO event_gamification (event_name, challenge_name, points, completions, badge_name, status) VALUES
      ('Yoga Summit 2026','Morning Meditation Master',50,127,'Zen Master','active'),
      ('Yoga Summit 2026','Networking Champion',30,89,'Connector','active'),
      ('Yoga Summit 2026','Workshop Explorer',20,203,'Knowledge Seeker','active'),
      ('Yoga Summit 2026','Social Share',10,341,'Digital Yogi','active')
    `);
    await client.query(`INSERT INTO event_emergency_plans (event_name, scenario, response_steps, responsible_person, contact, last_reviewed) VALUES
      ('Yoga Summit 2026','Medical Emergency','["Call 911 immediately","Send trained first aider to location","Clear area of bystanders","Meet paramedics at venue entrance","Complete incident report"]','Event Director - Sarah K','416-555-0100','2026-09-01'),
      ('Yoga Summit 2026','Fire Evacuation','["Activate fire alarm","Direct attendees to nearest exits (marked in red)","Assemble at parking lot C","Account for all attendees with registration list","Do not re-enter until fire dept clears"]','Safety Officer - Mike R','416-555-0101','2026-09-01')
    `);
    await client.query(`INSERT INTO event_awards (event_name, category, winner_name, runner_up, presented_by, notes) VALUES
      ('Yoga Summit 2026','Wellness Innovator of the Year','Dr. Priya Sharma','James Wilson','CEO Linda Chen','For pioneering AI-assisted yoga therapy'),
      ('Yoga Summit 2026','Community Champion Award','Wellness Warriors Toronto','FitLife Community','Board Chair','Recognized for 5 years of free community yoga'),
      ('Yoga Summit 2026','Best Studio Award','Om Studio Toronto','Zen Flow Studio','Industry Panel','Voted by over 2000 students'),
      ('Corporate Wellness Day','Corporate Wellness Excellence','TechCorp Inc','Canadian Bank','Wellness Council','First company to achieve 95% employee participation')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query('SELECT * FROM event_venues ORDER BY created_at DESC');
    return Response.json(rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `INSERT INTO event_venues (event_name, venue_name, address, capacity, inspection_status, inspection_notes)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
      [body.event_name, body.venue_name, body.address, body.capacity || 0, body.inspection_notes]
    );
    return Response.json(rows[0], { status: 201 });
  } finally { client.release(); }
}
