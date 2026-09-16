import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vs_scripts (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      video_type TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 60,
      target_audience TEXT,
      key_message TEXT,
      script_text TEXT,
      status TEXT DEFAULT 'draft',
      version INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vs_storyboards (
      id SERIAL PRIMARY KEY,
      script_id INTEGER REFERENCES vs_scripts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scenes JSONB DEFAULT '[]',
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vs_shot_plans (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      shots JSONB DEFAULT '[]',
      total_shots INTEGER DEFAULT 0,
      estimated_hours NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vs_locations (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      location_name TEXT NOT NULL,
      address TEXT,
      type TEXT,
      availability TEXT[],
      cost_per_day NUMERIC DEFAULT 0,
      notes TEXT,
      approved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS vs_cast (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'actor',
      rate_per_day NUMERIC DEFAULT 0,
      availability TEXT[],
      notes TEXT,
      confirmed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const existing = await pool.query('SELECT COUNT(*) FROM vs_scripts');
  if (parseInt(existing.rows[0].count) > 0) return;

  const scripts = await pool.query(`
    INSERT INTO vs_scripts (project_name, video_type, duration_seconds, target_audience, key_message, status, version)
    VALUES
      ('Soham Intro Reel 2026', 'brand', 60, 'Urban professionals 25-45', 'Transform your life through yoga', 'approved', 2),
      ('Pranayama Tutorial Series', 'tutorial', 120, 'Beginner yoga students', 'Master breath control in 4 steps', 'in_review', 1),
      ('Corporate Wellness Pitch', 'sales', 90, 'HR Directors & C-suite', 'Reduce burnout, boost productivity', 'draft', 1),
      ('30-Day Challenge Promo', 'ad', 30, 'Fitness millennials', 'Start your transformation today', 'draft', 1)
    RETURNING id, project_name
  `);

  const ids = scripts.rows.map((r: { id: number }) => r.id);

  await pool.query(`
    INSERT INTO vs_storyboards (script_id, title, scenes, status)
    VALUES
      ($1, 'Intro Reel Storyboard', '[
        {"scene":1,"shot_type":"wide","description":"Aerial studio view at golden hour","dialogue":"","duration_sec":8,"visual_notes":"Warm light, minimal space"},
        {"scene":2,"shot_type":"close_up","description":"Hands in prayer, slow reveal to instructor face","dialogue":"Welcome to Soham Yoga...","duration_sec":7,"visual_notes":"Shallow DoF, warm tones"},
        {"scene":3,"shot_type":"medium","description":"Diverse group in warrior pose","dialogue":"...where every breath is a new beginning.","duration_sec":10,"visual_notes":"All faces visible, synchronized"},
        {"scene":4,"shot_type":"wide","description":"Studio exterior, students arriving","dialogue":"Book your free trial class today.","duration_sec":8,"visual_notes":"Community feel, bright exterior"},
        {"scene":5,"shot_type":"close_up","description":"Logo reveal with tagline overlay","dialogue":"","duration_sec":5,"visual_notes":"Brand colors, clean typography"}
      ]', 'approved'),
      ($2, 'Pranayama Tutorial Board', '[
        {"scene":1,"shot_type":"close_up","description":"Extreme close-up of nostrils, visible breath","dialogue":"Most people breathe 20,000 times a day...","duration_sec":6,"visual_notes":"Macro lens, cool tones"},
        {"scene":2,"shot_type":"medium","description":"Instructor demonstrating Nadi Shodhana","dialogue":"Nadi Shodhana alternates breath between nostrils...","duration_sec":30,"visual_notes":"Clean white background, text overlays"},
        {"scene":3,"shot_type":"cutaway","description":"Animation: nervous system diagram","dialogue":"...activating the parasympathetic response","duration_sec":20,"visual_notes":"Infographic style, brand colors"},
        {"scene":4,"shot_type":"medium","description":"Kapalabhati demonstration close-up","dialogue":"Kapalabhati uses forceful exhales...","duration_sec":25,"visual_notes":"High contrast, dynamic movement"},
        {"scene":5,"shot_type":"wide","description":"Group outdoor sunrise practice","dialogue":"Start your pranayama journey today.","duration_sec":15,"visual_notes":"Golden sunrise, CTA overlay"}
      ]', 'draft')
  `, [ids[0], ids[1]]);

  await pool.query(`
    INSERT INTO vs_shot_plans (project_name, shots, total_shots, estimated_hours)
    VALUES ('Soham Intro Reel 2026', '[
      {"shot_no":1,"scene":1,"type":"wide","angle":"aerial","lens":"24mm","duration":8,"notes":"Crane shot from ceiling"},
      {"shot_no":2,"scene":2,"type":"close_up","angle":"eye_level","lens":"85mm","duration":7,"notes":"Manual focus pull"},
      {"shot_no":3,"scene":3,"type":"medium","angle":"eye_level","lens":"50mm","duration":10,"notes":"Dolly left to right"},
      {"shot_no":4,"scene":4,"type":"wide","angle":"low_angle","lens":"24mm","duration":8,"notes":"Static, exterior"},
      {"shot_no":5,"scene":5,"type":"close_up","angle":"eye_level","lens":"100mm","duration":5,"notes":"Logo card, locked off"}
    ]', 5, 4.5)
  `);

  await pool.query(`
    INSERT INTO vs_locations (project_name, location_name, address, type, availability, cost_per_day, notes, approved)
    VALUES
      ('Soham Intro Reel 2026', 'Soham Yoga Studio', '123 Wellness Ave, Toronto ON', 'indoor', ARRAY['2026-10-05','2026-10-06'], 0, 'Home studio — free access any time', TRUE),
      ('Corporate Wellness Pitch', 'Royal Bank Plaza Lobby', '200 Bay St, Toronto ON', 'corporate', ARRAY['2026-10-20'], 500, 'Requires security clearance 48h prior', FALSE),
      ('Pranayama Tutorial Series', 'Evergreen Brick Works', '550 Bayview Ave, Toronto ON', 'outdoor', ARRAY['2026-10-12','2026-10-19'], 200, 'Natural light excellent at 7AM. Permit required.', TRUE)
  `);

  await pool.query(`
    INSERT INTO vs_cast (project_name, role, name, type, rate_per_day, availability, notes, confirmed)
    VALUES
      ('Soham Intro Reel 2026', 'Lead Instructor', 'Priya Sharma', 'instructor', 0, ARRAY['2026-10-05'], 'Studio owner — no talent fee', TRUE),
      ('Soham Intro Reel 2026', 'Background Yogi 1', 'Anita Mehta', 'extra', 150, ARRAY['2026-10-05','2026-10-06'], 'Student volunteer, experienced practitioner', TRUE),
      ('Soham Intro Reel 2026', 'Background Yogi 2', 'Carlos Rivera', 'extra', 150, ARRAY['2026-10-05'], 'Intermediate level, available all day', FALSE),
      ('Corporate Wellness Pitch', 'HR Director (Talent)', 'Alex Thompson', 'actor', 400, ARRAY['2026-10-20'], 'Professional actor, teleprompter trained', TRUE),
      ('Pranayama Tutorial Series', 'Voiceover Artist', 'Deepa Nair', 'vo', 300, ARRAY['2026-10-10','2026-10-11'], 'Studio booking required separately', FALSE)
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables();
    await seedData();

    const scripts = await client.query(`SELECT * FROM vs_scripts ORDER BY created_at DESC`);
    const storyboards = await client.query(`SELECT * FROM vs_storyboards ORDER BY created_at DESC`);
    const locations = await client.query(`SELECT * FROM vs_locations ORDER BY created_at DESC`);
    const cast = await client.query(`SELECT * FROM vs_cast ORDER BY created_at DESC`);

    const stats = {
      total_scripts: scripts.rowCount,
      approved: scripts.rows.filter((r: { status: string }) => r.status === 'approved').length,
      in_review: scripts.rows.filter((r: { status: string }) => r.status === 'in_review').length,
      draft: scripts.rows.filter((r: { status: string }) => r.status === 'draft').length,
      total_storyboards: storyboards.rowCount,
      total_locations: locations.rowCount,
      approved_locations: locations.rows.filter((r: { approved: boolean }) => r.approved).length,
      total_cast: cast.rowCount,
      confirmed_cast: cast.rows.filter((r: { confirmed: boolean }) => r.confirmed).length,
    };

    return Response.json({ scripts: scripts.rows, storyboards: storyboards.rows, locations: locations.rows, cast: cast.rows, stats });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureTables();
    const body = await req.json();
    const { project_name, video_type, duration_seconds = 60, target_audience, key_message } = body;

    if (!project_name || !video_type) {
      return Response.json({ error: 'project_name and video_type are required' }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO vs_scripts (project_name, video_type, duration_seconds, target_audience, key_message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_name, video_type, duration_seconds, target_audience, key_message]
    );

    return Response.json({ script: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
