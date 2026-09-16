import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anim_projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      style TEXT,
      duration_seconds INTEGER DEFAULT 60,
      client TEXT,
      brief TEXT,
      script TEXT,
      status TEXT DEFAULT 'concept',
      complexity TEXT DEFAULT 'medium',
      estimated_hours NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS anim_assets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES anim_projects(id) ON DELETE CASCADE,
      asset_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      format TEXT,
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS anim_motion_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 30,
      style TEXT,
      tags TEXT[],
      usage_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS anim_repurpose_jobs (
      id SERIAL PRIMARY KEY,
      source_video TEXT NOT NULL,
      target_formats TEXT[],
      clips_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'queued',
      output_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const existing = await pool.query('SELECT COUNT(*) FROM anim_projects');
  if (parseInt(existing.rows[0].count) > 0) return;

  const projects = await pool.query(`
    INSERT INTO anim_projects (name, type, style, duration_seconds, client, brief, status, complexity, estimated_hours)
    VALUES
      ('Yoga Journey Explainer', 'explainer', 'flat_2d', 90, 'Soham Yoga Internal', 'Animated explainer showing the 8-limb path of yoga from beginner to advanced practitioner. Target: new students. Key message: yoga is a complete lifestyle system, not just exercise.', 'in_progress', 'medium', 24),
      ('Corporate Wellness Pitch Deck Anim', 'explainer', 'motion_graphics', 60, 'Soham Yoga — B2B', 'Animated presentation supporting the corporate wellness pitch. Highlight ROI statistics with animated counters, benefits with icon animations, testimonials with lower-thirds.', 'concept', 'high', 40),
      ('Brand Identity Motion Pack', 'motion_graphics', 'kinetic_typography', 30, 'Soham Yoga Internal', 'A set of branded motion graphics: animated logo intro, lower-thirds, transitions, outro screen, social media bumpers. To be used across all video content.', 'production', 'medium', 32),
      ('Virtual Studio 3D Walkthrough', '3d_animation', 'realistic_3d', 120, 'Soham Yoga Internal', '3D animated walkthrough of the virtual yoga studio concept. Shows student avatar joining a live class, moving through the digital studio space. Used for app onboarding video.', 'concept', 'very_high', 80),
      ('Pranayama Whiteboard Explainer', 'whiteboard', 'whiteboard_doodle', 120, 'Soham Yoga — Educational', 'Whiteboard-style animation explaining the science of pranayama breathing. Diagrams of lungs, nervous system, brain activity. Educational and accessible. Target: wellness curious audience.', 'storyboard', 'low', 16)
    RETURNING id
  `);

  const ids = projects.rows.map((r: { id: number }) => r.id);

  await pool.query(`
    INSERT INTO anim_assets (project_id, asset_name, asset_type, format, version, status, notes)
    VALUES
      ($1, 'Yoga Journey Character Rig', 'character', 'SVG', 2, 'approved', 'Gender-neutral yogi character with 12 animation states'),
      ($1, 'Background Environments Pack', 'background', 'SVG', 1, 'in_progress', 'Studio, outdoor, and abstract gradient backgrounds'),
      ($1, 'Icon Set — 8 Limbs of Yoga', 'icon_set', 'SVG', 1, 'approved', '8 unique icons for Yama, Niyama, Asana, Pranayama, Pratyahara, Dharana, Dhyana, Samadhi'),
      ($2, 'Animated Counter Module', 'ui_element', 'AE', 1, 'pending', 'Counter animation for percentage stats — needs final numbers'),
      ($3, 'Soham Logo Animation', 'brand_asset', 'AE', 3, 'approved', 'Lotus unfold + name reveal. 3s intro, 2s loop, 2s outro. Exported: ProRes + WebM'),
      ($3, 'Lower Third Templates (5 styles)', 'template', 'AE', 1, 'approved', 'Name + title, location, quote, stat, and CTA lower thirds'),
      ($4, '3D Studio Environment', 'environment', 'Blender', 1, 'in_progress', 'High-poly studio with yoga mats, lighting, windows. Render in progress.'),
      ($5, 'Lung Diagram Animation', 'diagram', 'SVG', 1, 'pending', 'Simplified anatomical lung diagram with breathing animation cues')
  `, [ids[0], ids[0], ids[0], ids[1], ids[2], ids[2], ids[3], ids[4]]);

  await pool.query(`
    INSERT INTO anim_motion_templates (name, category, duration_seconds, style, tags, usage_count)
    VALUES
      ('Lotus Bloom Intro', 'brand_intro', 5, 'organic', ARRAY['logo','intro','brand'], 12),
      ('Stat Counter Burst', 'data_viz', 8, 'kinetic', ARRAY['numbers','counter','impact'], 7),
      ('Slide Wipe Transition', 'transition', 2, 'clean', ARRAY['transition','wipe','slide'], 23),
      ('Floating Icon Loop', 'background_motion', 30, 'ambient', ARRAY['icons','loop','background'], 5),
      ('Testimonial Lower Third', 'lower_third', 6, 'minimal', ARRAY['name','title','testimonial'], 18),
      ('Social Media Bumper 15s', 'bumper', 15, 'energetic', ARRAY['social','reel','promo','cta'], 31)
  `);

  await pool.query(`
    INSERT INTO anim_repurpose_jobs (source_video, target_formats, clips_count, status, output_summary)
    VALUES
      ('yoga_journey_explainer_final.mp4', ARRAY['instagram_reel','youtube_short','linkedin_video'], 3, 'completed', 'Extracted: 30s Reel (Instagram), 60s Short (YouTube), 45s native (LinkedIn). Subtitles added to all.'),
      ('brand_motion_pack_v3.mp4', ARRAY['instagram_story','twitter_gif','email_banner'], 4, 'in_progress', 'Story version (1080x1920) in render. GIF export queued.'),
      ('pranayama_whiteboard_v1.mp4', ARRAY['instagram_reel','tiktok','youtube_short'], 3, 'queued', NULL)
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

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');

    let q = 'SELECT * FROM anim_projects WHERE 1=1';
    const vals: unknown[] = [];
    if (type) { vals.push(type); q += ` AND type = $${vals.length}`; }
    if (status) { vals.push(status); q += ` AND status = $${vals.length}`; }
    q += ' ORDER BY created_at DESC';

    const projects = await client.query(q, vals);
    const assets = await client.query('SELECT * FROM anim_assets ORDER BY created_at DESC');
    const templates = await client.query('SELECT * FROM anim_motion_templates ORDER BY usage_count DESC');
    const repurpose = await client.query('SELECT * FROM anim_repurpose_jobs ORDER BY created_at DESC');

    const allProjects = await client.query('SELECT * FROM anim_projects');
    const stats = {
      total: allProjects.rowCount,
      explainer: allProjects.rows.filter((r: { type: string }) => r.type === 'explainer').length,
      motion_graphics: allProjects.rows.filter((r: { type: string }) => r.type === 'motion_graphics').length,
      three_d: allProjects.rows.filter((r: { type: string }) => r.type === '3d_animation').length,
      whiteboard: allProjects.rows.filter((r: { type: string }) => r.type === 'whiteboard').length,
      concept: allProjects.rows.filter((r: { status: string }) => r.status === 'concept').length,
      in_progress: allProjects.rows.filter((r: { status: string }) => r.status === 'in_progress').length,
      completed: allProjects.rows.filter((r: { status: string }) => r.status === 'completed').length,
      total_assets: assets.rowCount,
      total_templates: templates.rowCount,
    };

    return Response.json({ projects: projects.rows, assets: assets.rows, templates: templates.rows, repurpose: repurpose.rows, stats });
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
    const { name, type, style, duration_seconds = 60, client: clientName, brief, complexity = 'medium', estimated_hours = 0 } = body;
    if (!name || !type) return Response.json({ error: 'name and type are required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO anim_projects (name, type, style, duration_seconds, client, brief, complexity, estimated_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, type, style, duration_seconds, clientName, brief, complexity, estimated_hours]
    );
    return Response.json({ project: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
