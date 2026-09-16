import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pp_jobs (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      video_filename TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      settings JSONB DEFAULT '{}',
      output_notes TEXT,
      assigned_to TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS pp_subtitle_tracks (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      format TEXT DEFAULT 'SRT',
      content TEXT,
      auto_generated BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'draft',
      word_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pp_dubbing_jobs (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      source_language TEXT NOT NULL,
      target_language TEXT NOT NULL,
      voice_style TEXT DEFAULT 'natural',
      status TEXT DEFAULT 'queued',
      estimated_minutes NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pp_thumbnail_assets (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      style TEXT,
      prompt TEXT,
      platform TEXT DEFAULT 'youtube',
      ctr_score NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'generated',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pp_clip_extractions (
      id SERIAL PRIMARY KEY,
      project_name TEXT NOT NULL,
      source_file TEXT,
      clips JSONB DEFAULT '[]',
      total_clips INTEGER DEFAULT 0,
      purpose TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function seedData(): Promise<void> {
  const pool = getPool();
  const existing = await pool.query('SELECT COUNT(*) FROM pp_jobs');
  if (parseInt(existing.rows[0].count) > 0) return;

  await pool.query(`
    INSERT INTO pp_jobs (project_name, video_filename, type, status, settings, assigned_to)
    VALUES
      ('Soham Intro Reel 2026', 'intro_reel_raw_v3.mp4', 'color_correction', 'in_progress', '{"lut":"Cinematic_Warm","exposure":0.2,"contrast":1.1}', 'James Chen'),
      ('Soham Intro Reel 2026', 'intro_reel_raw_v3.mp4', 'color_grading', 'queued', '{"grade_style":"cinematic_warm","saturation":1.05,"highlights":-0.1}', 'James Chen'),
      ('Pranayama Tutorial', 'pranayama_tutorial_raw.mp4', 'audio_editing', 'completed', '{"noise_reduction":true,"eq_preset":"voice_warmth","normalize_db":-14}', 'Maya Patel'),
      ('Corporate Pitch', 'corporate_pitch_raw.mp4', 'color_correction', 'queued', '{"lut":"Corporate_Clean","grade_style":"neutral"}', 'James Chen'),
      ('30-Day Challenge Promo', 'challenge_promo_raw.mp4', 'subtitle_creation', 'in_progress', '{"language":"en","format":"SRT","font_size":24}', 'Sarah Kim'),
      ('Pranayama Tutorial', 'pranayama_tutorial_raw.mp4', 'thumbnail_generation', 'completed', '{"platform":"youtube","styles":3}', 'Design Team'),
      ('Soham Intro Reel 2026', 'intro_reel_raw_v3.mp4', 'clip_extraction', 'queued', '{"formats":["reel","story","short"],"max_clips":5}', 'Sarah Kim'),
      ('Corporate Pitch', 'corporate_pitch_raw.mp4', 'ai_dubbing', 'queued', '{"source":"en","targets":["fr","hi"],"voice_style":"professional"}', 'AI Pipeline')
  `);

  await pool.query(`
    INSERT INTO pp_subtitle_tracks (project_name, language, format, content, auto_generated, status, word_count)
    VALUES
      ('Pranayama Tutorial', 'en', 'SRT', '1\n00:00:00,000 --> 00:00:05,000\nMost people breathe 20,000 times a day...\n\n2\n00:00:05,200 --> 00:00:10,000\nBut are they breathing correctly?\n\n3\n00:00:10,200 --> 00:00:18,000\nPranayama is the ancient yogic science of breath control.\n\n4\n00:00:18,200 --> 00:00:25,000\nIn this tutorial, we explore four foundational techniques.\n\n5\n00:00:25,200 --> 00:00:35,000\nNadi Shodhana — alternate nostril breathing for balance.\n\n6\n00:00:35,200 --> 00:00:45,000\nKapalabhati — forceful exhales to energize the body.\n\n7\n00:00:45,200 --> 00:00:55,000\nUjjayi — the ocean breath for calming the mind.\n\n8\n00:00:55,200 --> 00:01:05,000\nBhramari — the humming bee breath for stress relief.\n\n9\n00:01:05,200 --> 00:01:10,000\nStart your pranayama journey — link in bio.', true, 'approved', 62),
      ('Soham Intro Reel 2026', 'en', 'SRT', '1\n00:00:00,000 --> 00:00:05,000\nWelcome to Soham Yoga.\n\n2\n00:00:05,200 --> 00:00:15,000\nWhere every breath is a new beginning.\n\n3\n00:00:15,200 --> 00:00:25,000\nDiscover transformative yoga and meditation.\n\n4\n00:00:25,200 --> 00:00:35,000\nFor all levels — beginner to advanced.\n\n5\n00:00:35,200 --> 00:00:45,000\nJoin our community of 500+ students.\n\n6\n00:00:45,200 --> 00:00:55,000\nBook your free trial class today.\n\n7\n00:00:55,200 --> 00:01:00,000\nsohamyoga.ca', false, 'approved', 45),
      ('30-Day Challenge Promo', 'fr', 'SRT', '1\n00:00:00,000 --> 00:00:04,000\nTransformez votre corps et votre esprit en 30 jours.\n\n2\n00:00:04,200 --> 00:00:09,000\nChallenge yoga Soham — Sessions guidées quotidiennes.\n\n3\n00:00:09,200 --> 00:00:14,000\nCommunauté de responsabilisation incluse.\n\n4\n00:00:14,200 --> 00:00:20,000\nDémarrez gratuitement — Places limitées!', true, 'draft', 38)
  `);

  await pool.query(`
    INSERT INTO pp_dubbing_jobs (project_name, source_language, target_language, voice_style, status, estimated_minutes)
    VALUES
      ('Pranayama Tutorial', 'en', 'fr', 'natural', 'completed', 2.5),
      ('Pranayama Tutorial', 'en', 'hi', 'warm', 'in_progress', 2.5)
  `);

  await pool.query(`
    INSERT INTO pp_thumbnail_assets (project_name, style, prompt, platform, ctr_score, status, notes)
    VALUES
      ('Pranayama Tutorial', 'bold_text', 'Instructor in meditation pose, text: "Master Breathing in 4 Steps", bold red text overlay on dark background', 'youtube', 8.4, 'approved', 'High contrast, face visible — strong CTR indicator'),
      ('Pranayama Tutorial', 'minimalist', 'Clean white background, lotus flower graphic, pastel text: "Ancient Breathing Techniques", gentle colors', 'instagram', 6.2, 'generated', 'Calmer aesthetic, good for organic wellness audience'),
      ('Soham Intro Reel 2026', 'lifestyle', 'Smiling instructor in warrior pose, studio light, text: "Your Journey Starts Here", warm golden tones', 'youtube', 7.8, 'approved', 'Brand-consistent, community feel'),
      ('30-Day Challenge Promo', 'urgency', 'Bold countdown style, text: "30-DAY CHALLENGE — Join FREE", bright orange accent, limited spots badge', 'youtube', 9.1, 'approved', 'Urgency framing — highest CTR in this batch')
  `);

  await pool.query(`
    INSERT INTO pp_clip_extractions (project_name, source_file, clips, total_clips, purpose)
    VALUES
      ('Pranayama Tutorial', 'pranayama_tutorial_final.mp4', '[
        {"clip_no":1,"start":"00:00:10","end":"00:00:40","duration":30,"format":"reel","title":"Nadi Shodhana 30s Reel","platform":"instagram"},
        {"clip_no":2,"start":"00:00:35","end":"00:00:50","duration":15,"format":"story","title":"Kapalabhati Story","platform":"instagram"},
        {"clip_no":3,"start":"00:00:00","end":"00:01:00","duration":60,"format":"short","title":"Full Pranayama Short","platform":"youtube"}
      ]', 3, 'social_repurposing'),
      ('Soham Intro Reel 2026', 'intro_reel_final.mp4', '[
        {"clip_no":1,"start":"00:00:00","end":"00:00:30","duration":30,"format":"reel","title":"Intro 30s Reel","platform":"instagram"},
        {"clip_no":2,"start":"00:00:45","end":"00:01:00","duration":15,"format":"story","title":"CTA Story","platform":"instagram"}
      ]', 2, 'social_distribution')
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

    let q = 'SELECT * FROM pp_jobs WHERE 1=1';
    const vals: unknown[] = [];
    if (type) { vals.push(type); q += ` AND type = $${vals.length}`; }
    q += ' ORDER BY created_at DESC';

    const jobs = await client.query(q, vals);
    const subtitles = await client.query('SELECT * FROM pp_subtitle_tracks ORDER BY created_at DESC');
    const dubbing = await client.query('SELECT * FROM pp_dubbing_jobs ORDER BY created_at DESC');
    const thumbnails = await client.query('SELECT * FROM pp_thumbnail_assets ORDER BY created_at DESC');
    const clips = await client.query('SELECT * FROM pp_clip_extractions ORDER BY created_at DESC');

    const allJobs = await client.query('SELECT * FROM pp_jobs');
    const stats = {
      total: allJobs.rowCount,
      queued: allJobs.rows.filter((r: { status: string }) => r.status === 'queued').length,
      in_progress: allJobs.rows.filter((r: { status: string }) => r.status === 'in_progress').length,
      review: allJobs.rows.filter((r: { status: string }) => r.status === 'review').length,
      completed: allJobs.rows.filter((r: { status: string }) => r.status === 'completed').length,
      subtitle_tracks: subtitles.rowCount,
      dubbing_jobs: dubbing.rowCount,
      thumbnail_assets: thumbnails.rowCount,
    };

    return Response.json({ jobs: jobs.rows, subtitles: subtitles.rows, dubbing: dubbing.rows, thumbnails: thumbnails.rows, clips: clips.rows, stats });
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
    const { project_name, video_filename, type, settings = {}, assigned_to } = body;
    if (!project_name || !type) return Response.json({ error: 'project_name and type are required' }, { status: 400 });

    const result = await client.query(
      `INSERT INTO pp_jobs (project_name, video_filename, type, settings, assigned_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [project_name, video_filename, type, JSON.stringify(settings), assigned_to]
    );
    return Response.json({ job: result.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
