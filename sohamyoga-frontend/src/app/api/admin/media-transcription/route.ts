export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

async function ensureSchema(client: import('pg').PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS transcription_jobs (
      id SERIAL PRIMARY KEY, title TEXT, source_type TEXT DEFAULT 'upload',
      source_url TEXT, file_name TEXT, duration_seconds INTEGER DEFAULT 0,
      language TEXT DEFAULT 'en', status TEXT DEFAULT 'queued',
      transcript_text TEXT, word_count INTEGER DEFAULT 0,
      summary TEXT, chapters JSONB, action_items JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS transcription_exports (
      id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES transcription_jobs(id),
      format TEXT, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS transcription_translations (
      id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES transcription_jobs(id),
      target_language TEXT, translated_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows } = await client.query('SELECT COUNT(*) FROM transcription_jobs');
  if (parseInt(rows[0].count) === 0) {
    await client.query(`
      INSERT INTO transcription_jobs (title, source_type, file_name, duration_seconds, language, status, transcript_text, word_count, summary, chapters, action_items, completed_at) VALUES
      (
        'Morning Vinyasa Flow — September Class',
        'upload',
        'vinyasa_sept_class.mp4',
        3420,
        'en',
        'completed',
        'Welcome everyone to today''s morning vinyasa flow class. We are going to start in a comfortable seated position. Take a moment to close your eyes and connect with your breath. Let the outside world fall away as we turn our attention inward. Begin by taking three deep breaths in through the nose, and out through the mouth. Allow your shoulders to relax away from your ears. Feel your sit bones ground into the earth beneath you. We will move through a dynamic warm-up sequence, flowing from cat-cow into downward dog, and building toward our peak pose today which will be warrior two. Remember to honor your body and modify as needed. There are no judgments here. Each breath is an opportunity to go deeper. Let us begin our sun salutations. Inhale arms up, exhale fold forward. Step back to plank. Lower halfway, inhale to cobra. Exhale downward dog. Hold for five breaths. Walk your feet to your hands. Inhale halfway up. Exhale fold. Inhale rise up with arms overhead. Exhale hands to heart. That is one cycle. We will do three more before moving into our standing sequence.',
        200,
        'A comprehensive morning vinyasa yoga class focusing on connecting breath to movement. The instructor guides students through sun salutations, building toward warrior two as the peak pose, emphasizing body awareness and self-compassion. Students are encouraged to modify poses as needed throughout the 57-minute session.',
        '[{"title":"Opening and Centering","timestamp":"00:00","summary":"Seated meditation, breath connection, intention setting"},{"title":"Warm-Up Sequence","timestamp":"05:30","summary":"Cat-cow, downward dog, spinal warm-up"},{"title":"Sun Salutations","timestamp":"12:00","summary":"Three rounds of Surya Namaskar A"},{"title":"Standing Sequence","timestamp":"25:00","summary":"Warrior series building to peak pose"},{"title":"Cool Down","timestamp":"48:00","summary":"Hip openers, supine twists, savasana"}]',
        '[{"item":"Send class recording link to registered students","owner":"Admin","due_date":"2026-09-17"},{"item":"Upload video to members portal","owner":"Content Team","due_date":"2026-09-18"},{"item":"Post class highlights to Instagram","owner":"Marketing","due_date":"2026-09-18"}]',
        NOW() - INTERVAL '2 days'
      ),
      (
        'Beginner Yoga for Stress Relief — YouTube Tutorial',
        'youtube',
        NULL,
        2580,
        'en',
        'completed',
        'Hello and welcome to this beginner-friendly yoga session designed specifically for stress relief. I am so glad you have carved out this time for yourself today. Whether you are coming to the mat after a long day at work or looking to start your morning with some calm, this practice has something for everyone. We are going to spend the next 43 minutes releasing tension from the body, calming the nervous system, and cultivating a sense of inner peace. You do not need any prior yoga experience for this class. All you need is a comfortable space, a mat if you have one, and a willingness to show up for yourself. We will begin lying on our backs in constructive rest position with knees bent and feet flat on the floor. Close your eyes. Notice the weight of your body against the earth. Begin to deepen your breath, making the exhale slightly longer than the inhale. This activates the parasympathetic nervous system, the rest and digest response, helping to lower cortisol levels. Let us stay here for two minutes simply breathing. Now gently hug your knees into your chest, rock a little side to side, massaging the lower back. This is called apanasana or knees to chest pose and it is wonderful for releasing tension in the lumbar spine.',
        198,
        'A beginner-friendly YouTube tutorial focused on stress relief through yoga and breathwork. The instructor covers foundational poses and explains the science behind how yoga activates the parasympathetic nervous system. Suitable for all levels with no prior experience required.',
        '[{"title":"Introduction and Setup","timestamp":"00:00","summary":"Welcome, what to expect, materials needed"},{"title":"Supine Warm-Up","timestamp":"03:00","summary":"Constructive rest, knee hugs, spinal warm-up"},{"title":"Gentle Standing Poses","timestamp":"15:00","summary":"Mountain pose, forward fold, gentle warrior"},{"title":"Floor Sequence","timestamp":"28:00","summary":"Child''s pose, pigeon, seated forward fold"},{"title":"Savasana and Closing","timestamp":"38:00","summary":"Final relaxation and meditation"}]',
        '[{"item":"Add YouTube chapter markers based on timestamp data","owner":"Content Team","due_date":"2026-09-19"},{"item":"Translate captions to Spanish and French","owner":"Marketing","due_date":"2026-09-22"},{"item":"Create short-form clip from stress relief segment","owner":"Social Media","due_date":"2026-09-20"}]',
        NOW() - INTERVAL '1 day'
      ),
      (
        'Q3 Marketing Strategy — Client Meeting',
        'meeting',
        'q3_marketing_meeting.m4a',
        3900,
        'en',
        'in_progress',
        NULL,
        0,
        NULL,
        NULL,
        NULL,
        NULL
      ),
      (
        'Autumn Wellness Webinar — Mindfulness & Nutrition',
        'upload',
        'autumn_wellness_webinar.mp4',
        7200,
        'en',
        'queued',
        NULL,
        0,
        NULL,
        NULL,
        NULL,
        NULL
      )
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
    const { rows: jobs } = await client.query(`
      SELECT id, title, source_type, file_name, source_url, duration_seconds, language, status,
             word_count, created_at, completed_at,
             CASE WHEN transcript_text IS NOT NULL THEN LEFT(transcript_text, 100) ELSE NULL END AS transcript_preview
      FROM transcription_jobs ORDER BY created_at DESC
    `);
    const { rows: stats } = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='queued') AS queued,
        COUNT(*) FILTER (WHERE status='in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COALESCE(SUM(word_count),0) AS total_words,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) FILTER (WHERE completed_at IS NOT NULL),0) AS avg_completion_minutes
      FROM transcription_jobs
    `);
    return Response.json({ jobs, stats: stats[0] });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { title, source_type = 'upload', source_url, file_name, language = 'en' } = body;
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { rows } = await client.query(`
      INSERT INTO transcription_jobs (title, source_type, source_url, file_name, language)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [title, source_type, source_url || null, file_name || null, language]);
    return Response.json(rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
