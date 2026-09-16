import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_scripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      project_type TEXT DEFAULT 'ad',
      duration_target_seconds INT,
      word_count INT,
      status TEXT DEFAULT 'draft',
      script_body TEXT,
      hook TEXT,
      call_to_action TEXT,
      target_audience TEXT,
      tone TEXT DEFAULT 'professional',
      voice_notes TEXT,
      revision_count INT DEFAULT 0,
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS storyboards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      script_id UUID REFERENCES video_scripts(id),
      title TEXT NOT NULL,
      total_scenes INT DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS storyboard_scenes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      storyboard_id UUID REFERENCES storyboards(id) ON DELETE CASCADE,
      scene_number INT NOT NULL,
      shot_type TEXT,
      camera_angle TEXT,
      description TEXT,
      dialogue TEXT,
      action TEXT,
      duration_seconds INT DEFAULT 5,
      visual_notes TEXT,
      audio_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS production_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      script_id UUID REFERENCES video_scripts(id),
      shoot_date DATE,
      location TEXT,
      director TEXT,
      crew_json JSONB DEFAULT '[]',
      equipment_json JSONB DEFAULT '[]',
      call_sheet_notes TEXT,
      status TEXT DEFAULT 'planning',
      budget_cad NUMERIC(10,2),
      actual_cost_cad NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS webinars (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      host_name TEXT,
      co_hosts TEXT[],
      platform TEXT DEFAULT 'zoom',
      meeting_url TEXT,
      scheduled_at TIMESTAMPTZ,
      duration_minutes INT DEFAULT 60,
      capacity INT,
      registration_count INT DEFAULT 0,
      attendees_count INT DEFAULT 0,
      recording_url TEXT,
      agenda_json JSONB DEFAULT '[]',
      status TEXT DEFAULT 'planned',
      follow_up_sent BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();

  // Check if already seeded
  const check = await pool.query('SELECT COUNT(*) FROM video_scripts');
  if (parseInt(check.rows[0].count) > 0) return;

  // Seed 5 scripts
  const scriptIds = await pool.query(`
    INSERT INTO video_scripts (title, project_type, duration_target_seconds, word_count, status, hook, call_to_action, target_audience, tone, script_body, voice_notes, revision_count)
    VALUES
      ('Yoga Studio Welcome Reel', 'reel', 30, 65, 'approved', 'Discover your inner calm in just 30 seconds...', 'Book your free trial class today', 'Women 25-45, urban professionals', 'warm', 'Welcome to Soham Yoga — where every breath is a new beginning. Whether you are a beginner or advanced practitioner, our certified instructors guide you through transformative sessions. Join our community of 500+ students. Book your free trial today.', 'Soft breathy delivery, pause after each sentence', 2),
      ('Explainer: What is Pranayama?', 'explainer', 90, 195, 'approved', 'Most people breathe 20,000 times a day without thinking about it...', 'Start your pranayama journey — link in bio', 'General wellness audience, new to yoga', 'educational', 'Pranayama is the ancient yogic science of breath control. The word comes from Sanskrit: prana meaning life force, and ayama meaning expansion. In this video, we explore four foundational techniques: Nadi Shodhana, Kapalabhati, Ujjayi, and Bhramari. Each technique has a specific therapeutic effect on the nervous system...', 'Calm, measured pace. Emphasize Sanskrit words clearly.', 1),
      ('Corporate Wellness Program Pitch', 'corporate', 120, 260, 'review', 'What if you could reduce employee sick days by 30%?', 'Contact us for a corporate wellness demo', 'HR directors, C-suite executives', 'professional', 'Employee burnout costs Canadian businesses $23 billion annually. Soham Yoga corporate wellness programs deliver on-site and virtual yoga and meditation sessions tailored to your team. Our 6-week program has shown measurable improvements in employee satisfaction, focus, and productivity. Let us bring wellness to your workplace.', 'Authoritative but approachable. Not salesy.', 0),
      ('30-Day Yoga Challenge Promo', 'ad', 15, 35, 'draft', 'Transform your body and mind in 30 days — guaranteed', 'Join the challenge — spots limited!', 'Fitness-focused millennials', 'energetic', 'Join the Soham 30-Day Yoga Challenge. Daily guided sessions. Accountability community. Real results. Start free. Limited spots available — sign up now!', 'High energy, fast-paced delivery', 0),
      ('Testimonial: Sarah\'s Journey', 'testimonial', 60, 130, 'in_production', '"I never thought yoga was for me..."', 'Start your own journey at sohamyoga.ca', 'Yoga skeptics, beginners', 'authentic', 'Sarah came to us after a stressful corporate restructuring left her anxious and sleep-deprived. After just 8 weeks of our beginner program, she reports sleeping 7 hours a night, a 40% reduction in anxiety scores, and discovering a community she calls family. This is Sarah\'s story — and it could be yours.', 'Let Sarah speak in her own words. Minimal narration.', 1)
    RETURNING id
  `);

  const ids = scriptIds.rows.map((r: { id: string }) => r.id);

  // Seed 3 storyboards
  const sb1 = await pool.query(`
    INSERT INTO storyboards (script_id, title, total_scenes, status)
    VALUES ($1, 'Welcome Reel Storyboard', 4, 'approved') RETURNING id
  `, [ids[0]]);

  const sb2 = await pool.query(`
    INSERT INTO storyboards (script_id, title, total_scenes, status)
    VALUES ($1, 'Pranayama Explainer Board', 4, 'draft') RETURNING id
  `, [ids[1]]);

  const sb3 = await pool.query(`
    INSERT INTO storyboards (script_id, title, total_scenes, status)
    VALUES ($1, 'Corporate Wellness Pitch Board', 4, 'draft') RETURNING id
  `, [ids[2]]);

  // Seed scenes for storyboard 1
  await pool.query(`
    INSERT INTO storyboard_scenes (storyboard_id, scene_number, shot_type, camera_angle, description, dialogue, action, duration_seconds, visual_notes, audio_notes)
    VALUES
      ($1, 1, 'wide', 'high_angle', 'Aerial view of the yoga studio — morning light streaming through windows', '', 'Camera slowly tilts down from ceiling to students in child''s pose', 8, 'Golden hour light, clean minimalist space', 'Soft ambient music fades in'),
      ($1, 2, 'close_up', 'eye_level', 'Close-up of hands in prayer position, focus pulls to face', 'Welcome to Soham Yoga...', 'Instructor opens eyes slowly and smiles', 7, 'Shallow depth of field, warm tones', 'Voiceover begins over ambient music'),
      ($1, 3, 'medium', 'eye_level', 'Medium shot of diverse group in warrior pose, synchronized', '...where every breath is a new beginning.', 'Group transitions from warrior to mountain pose together', 8, 'Wide aperture, all faces visible', 'Music swells slightly'),
      ($1, 4, 'wide', 'low_angle', 'Wide shot of studio exterior — branded signage, students arriving', 'Book your free trial class today.', 'Door opens, new student greeted warmly', 7, 'Bright exterior shot, community feel', 'Upbeat music outro, CTA text overlay')
  `, [sb1.rows[0].id]);

  // Seed scenes for storyboard 2
  await pool.query(`
    INSERT INTO storyboard_scenes (storyboard_id, scene_number, shot_type, camera_angle, description, dialogue, action, duration_seconds, visual_notes, audio_notes)
    VALUES
      ($1, 1, 'close_up', 'eye_level', 'Extreme close-up of nostrils, breath visible in cold air', 'Most people breathe 20,000 times a day...', 'Breath cloud forms and dissipates', 5, 'Macro lens, cool blue tones', 'Calm narrator voiceover'),
      ($1, 2, 'medium', 'eye_level', 'Instructor demonstrating Nadi Shodhana — alternate nostril breathing', 'Nadi Shodhana alternates breath between nostrils...', 'Slow, deliberate hand movement to nose', 25, 'Clean white background, text animation overlays', 'Soft meditation bell at transition'),
      ($1, 3, 'cutaway', 'high_angle', 'Animation overlay: human silhouette with highlighted nervous system', '...triggering the parasympathetic nervous system', 'Animated pulse of calm spreading through body', 20, 'Infographic style, brand colors', 'Whoosh sound for animation, then silence'),
      ($1, 4, 'wide', 'eye_level', 'Group of students practicing pranayama outdoors at sunrise', 'Start your pranayama journey today.', 'Pan across peaceful group, CTA appears', 15, 'Golden sunrise, natural setting', 'Uplifting acoustic music, fade to CTA')
  `, [sb2.rows[0].id]);

  // Seed scenes for storyboard 3
  await pool.query(`
    INSERT INTO storyboard_scenes (storyboard_id, scene_number, shot_type, camera_angle, description, dialogue, action, duration_seconds, visual_notes, audio_notes)
    VALUES
      ($1, 1, 'wide', 'high_angle', 'Busy open-plan office — stressed employees, cluttered desks', 'What if you could reduce employee sick days by 30%?', 'Time-lapse of hectic workday, then freeze', 10, 'Slightly desaturated, fluorescent lighting', 'Office noise, then sudden silence'),
      ($1, 2, 'medium', 'eye_level', 'Same office transformed — employees doing desk yoga and breathing', 'Soham Yoga corporate wellness programs...', 'Dissolve transition from stressed to calm office', 20, 'Warm, natural light added in post', 'Uplifting background music begins'),
      ($1, 3, 'close_up', 'eye_level', 'Screen showing analytics dashboard with upward metrics', '...measurable improvements in satisfaction and productivity', 'Numbers animate upward — 30% less sick days, 4.8 satisfaction', 15, 'Clean data visualization, brand colors', 'Subtle notification sound for each metric'),
      ($1, 4, 'medium', 'eye_level', 'HR Director smiling, looking at camera, corporate setting', 'Contact us for a corporate wellness demo.', 'HR director nods confidently to camera', 10, 'Professional corporate backdrop', 'Confident music close, clean CTA')
  `, [sb3.rows[0].id]);

  // Seed 2 production plans
  await pool.query(`
    INSERT INTO production_plans (title, script_id, shoot_date, location, director, crew_json, equipment_json, call_sheet_notes, status, budget_cad, actual_cost_cad)
    VALUES
      ($1, $2, '2026-10-05', 'Soham Yoga Studio, 123 Wellness Ave, Toronto ON', 'Priya Sharma', '[{"role":"Director of Photography","name":"James Chen","contact":"james@visionlens.ca"},{"role":"Sound Engineer","name":"Maya Patel","contact":"maya@soundcraft.ca"},{"role":"Grip/Gaffer","name":"Tom Wilson","contact":"tom@lightworks.ca"}]', '[{"item":"Sony FX6 Camera","quantity":1,"notes":"4K/120fps capable"},{"item":"Ronin RS3 Gimbal","quantity":1,"notes":"For smooth movement shots"},{"item":"LED Panel Kit (3x)","quantity":1,"notes":"Daylight balanced 5600K"},{"item":"Boom Mic + Lavalier","quantity":2,"notes":"Sennheiser MKH50 boom"}]', 'Call time: 7:00 AM. Students arrive 8:00 AM. Shoot: 8:30 AM - 2:00 PM. Lunch break 12:00 PM. Wrap by 3:00 PM.', 'confirmed', 3500.00, 3200.00),
      ($2, $3, '2026-10-18', 'Client Office — Royal Bank Plaza, Toronto ON', 'Priya Sharma', '[{"role":"Director of Photography","name":"James Chen","contact":"james@visionlens.ca"},{"role":"Teleprompter Operator","name":"Sarah Kim","contact":"sarah@prompterpro.ca"}]', '[{"item":"Sony FX6 Camera","quantity":1,"notes":"Corporate interview setup"},{"item":"Teleprompter","quantity":1,"notes":"iPad-based, 15-inch screen"},{"item":"Interview Lighting Kit","quantity":1,"notes":"Softbox + hair light + background light"}]', 'Arrive 30 min early for client location walkthrough. Confirm backdrop colour with client HR team (navy preferred). Talent: HR Director Alex Thompson. Script approved.', 'planning', 2000.00, NULL)
  `, [ids[0], ids[2]]);

  // Seed 4 webinars
  await pool.query(`
    INSERT INTO webinars (title, description, host_name, co_hosts, platform, scheduled_at, duration_minutes, capacity, registration_count, attendees_count, status, agenda_json, follow_up_sent)
    VALUES
      ('Introduction to Yoga for Beginners', 'A beginner-friendly session covering fundamentals of yoga practice, breathwork, and establishing a home routine.', 'Priya Sharma', ARRAY['Guest Teacher: Arjun Menon'], 'zoom', NOW() + INTERVAL '14 days', 60, 200, 87, 0, 'planned', '[{"time":"7:00 PM","topic":"Welcome & introductions","speaker":"Priya Sharma","duration":5},{"time":"7:05 PM","topic":"What is yoga? Origins and philosophy","speaker":"Priya Sharma","duration":15},{"time":"7:20 PM","topic":"Beginner poses demonstration","speaker":"Arjun Menon","duration":25},{"time":"7:45 PM","topic":"Building your home practice","speaker":"Priya Sharma","duration":10},{"time":"7:55 PM","topic":"Q&A","speaker":"Both","duration":5}]', false),
      ('Stress Relief Through Pranayama', 'Live breathing practice session with science-backed techniques for workplace stress and anxiety.', 'Dr. Meera Singh', ARRAY[]::TEXT[], 'google_meet', NOW() + INTERVAL '7 days', 45, 100, 62, 0, 'planned', '[{"time":"12:00 PM","topic":"Stress physiology overview","speaker":"Dr. Meera Singh","duration":10},{"time":"12:10 PM","topic":"Nadi Shodhana practice","speaker":"Dr. Meera Singh","duration":15},{"time":"12:25 PM","topic":"Kapalabhati practice","speaker":"Dr. Meera Singh","duration":10},{"time":"12:35 PM","topic":"Integration and daily routine","speaker":"Dr. Meera Singh","duration":10}]', false),
      ('Corporate Yoga: ROI for HR Teams', 'Webinar for HR professionals exploring the business case for workplace yoga programs.', 'Priya Sharma', ARRAY['Business Dev: Raj Kumar'], 'zoom', NOW() - INTERVAL '3 days', 75, 50, 43, 38, 'completed', '[{"time":"2:00 PM","topic":"Welcome","speaker":"Raj Kumar","duration":5},{"time":"2:05 PM","topic":"The cost of workplace stress in Canada","speaker":"Priya Sharma","duration":20},{"time":"2:25 PM","topic":"Our corporate program overview","speaker":"Priya Sharma","duration":20},{"time":"2:45 PM","topic":"Case studies: 3 client examples","speaker":"Raj Kumar","duration":15},{"time":"3:00 PM","topic":"Q&A and pricing","speaker":"Both","duration":15}]', true),
      ('Advanced Inversions Masterclass', 'For experienced yogis: headstand, shoulderstand, and handstand progression with safety cues.', 'Senior Teacher: Nisha Kapoor', ARRAY[]::TEXT[], 'youtube_live', NOW() + INTERVAL '21 days', 90, 500, 134, 0, 'planned', '[{"time":"6:00 PM","topic":"Safety and contraindications","speaker":"Nisha Kapoor","duration":15},{"time":"6:15 PM","topic":"Core and shoulder prep sequence","speaker":"Nisha Kapoor","duration":20},{"time":"6:35 PM","topic":"Supported headstand progression","speaker":"Nisha Kapoor","duration":20},{"time":"6:55 PM","topic":"Handstand wall work","speaker":"Nisha Kapoor","duration":20},{"time":"7:15 PM","topic":"Cool down and Q&A","speaker":"Nisha Kapoor","duration":15}]', false)
  `);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    await ensureTables();
    await seedData();

    const pool = getPool();

    const [scripts, storyboards, plans, webinars] = await Promise.all([
      pool.query('SELECT * FROM video_scripts ORDER BY created_at DESC'),
      pool.query('SELECT sb.*, vs.title as script_title FROM storyboards sb LEFT JOIN video_scripts vs ON vs.id = sb.script_id ORDER BY sb.created_at DESC'),
      pool.query('SELECT pp.*, vs.title as script_title FROM production_plans pp LEFT JOIN video_scripts vs ON vs.id = pp.script_id ORDER BY pp.created_at DESC'),
      pool.query('SELECT * FROM webinars ORDER BY scheduled_at ASC'),
    ]);

    const scriptStats = {
      total: scripts.rows.length,
      approved: scripts.rows.filter((s: { status: string }) => s.status === 'approved').length,
      in_production: scripts.rows.filter((s: { status: string }) => s.status === 'in_production').length,
      draft: scripts.rows.filter((s: { status: string }) => s.status === 'draft').length,
      review: scripts.rows.filter((s: { status: string }) => s.status === 'review').length,
    };

    const webinarStats = {
      total: webinars.rows.length,
      upcoming: webinars.rows.filter((w: { status: string }) => w.status === 'planned').length,
      completed: webinars.rows.filter((w: { status: string }) => w.status === 'completed').length,
    };

    return Response.json({
      scripts: scripts.rows,
      storyboards: storyboards.rows,
      production_plans: plans.rows,
      webinars: webinars.rows,
      stats: {
        scripts: scriptStats,
        storyboards: storyboards.rows.length,
        productions: plans.rows.length,
        webinars: webinarStats,
      },
    });
  } catch (err) {
    console.error('[video-production GET]', err);
    return Response.json({ error: 'Failed to load video production data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    await ensureTables();

    const body = await req.json() as Record<string, unknown>;
    const { type, ...data } = body;

    const pool = getPool();

    if (type === 'script') {
      const { title, project_type, duration_target_seconds, tone, target_audience, call_to_action, hook, script_body, voice_notes } = data as Record<string, string | number>;
      const result = await pool.query(
        `INSERT INTO video_scripts (title, project_type, duration_target_seconds, tone, target_audience, call_to_action, hook, script_body, voice_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [title, project_type || 'ad', duration_target_seconds || 30, tone || 'professional', target_audience, call_to_action, hook, script_body, voice_notes]
      );
      return Response.json(result.rows[0], { status: 201 });
    }

    if (type === 'storyboard') {
      const { title, script_id } = data as Record<string, string>;
      const result = await pool.query(
        `INSERT INTO storyboards (title, script_id) VALUES ($1,$2) RETURNING *`,
        [title, script_id || null]
      );
      return Response.json(result.rows[0], { status: 201 });
    }

    if (type === 'production_plan') {
      const { title, script_id, shoot_date, location, director, budget_cad, call_sheet_notes } = data as Record<string, string | number>;
      const result = await pool.query(
        `INSERT INTO production_plans (title, script_id, shoot_date, location, director, budget_cad, call_sheet_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [title, script_id || null, shoot_date || null, location, director, budget_cad || null, call_sheet_notes]
      );
      return Response.json(result.rows[0], { status: 201 });
    }

    if (type === 'webinar') {
      const { title, description, host_name, platform, scheduled_at, duration_minutes, capacity } = data as Record<string, string | number>;
      const result = await pool.query(
        `INSERT INTO webinars (title, description, host_name, platform, scheduled_at, duration_minutes, capacity)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [title, description, host_name, platform || 'zoom', scheduled_at || null, duration_minutes || 60, capacity || null]
      );
      return Response.json(result.rows[0], { status: 201 });
    }

    return Response.json({ error: 'Unknown type' }, { status: 400 });
  } catch (err) {
    console.error('[video-production POST]', err);
    return Response.json({ error: 'Failed to create record' }, { status: 500 });
  }
}
