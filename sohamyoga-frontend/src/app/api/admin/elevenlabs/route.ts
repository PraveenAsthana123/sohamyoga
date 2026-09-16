import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ensureSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS elevenlabs_generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      voice_id TEXT NOT NULL,
      voice_name TEXT,
      input_text TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      model_id TEXT DEFAULT 'eleven_multilingual_v2',
      audio_url TEXT,
      audio_base64 TEXT,
      duration_seconds NUMERIC(6,2),
      character_count INT,
      use_case TEXT DEFAULT 'general',
      status TEXT DEFAULT 'done',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed sample records if table is empty
  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM elevenlabs_generations');
  if (parseInt(rows[0].cnt, 10) === 0) {
    await pool.query(`
      INSERT INTO elevenlabs_generations (voice_id, voice_name, input_text, language, model_id, character_count, duration_seconds, use_case, status)
      VALUES
        ('21m00Tcm4TlvDq8ikWAM', 'Rachel', 'Welcome to SohamYoga, your trusted partner for holistic wellness. Visit us today!', 'en', 'eleven_multilingual_v2', 84, 4.20, 'ad_voiceover', 'done'),
        ('TxGEqnHWrfWFTfGW9XjX', 'Josh', 'Breaking news: New yoga classes now available every morning at 6 AM.', 'en', 'eleven_multilingual_v2', 66, 3.50, 'social_post', 'done'),
        ('pNInz6obpgDQGcFmaJgB', 'Adam', 'In this video, we explore the ancient art of yoga and its modern applications for stress relief.', 'en', 'eleven_multilingual_v2', 94, 5.10, 'video_narration', 'done'),
        ('EXAVITQu4vr4xnSDxMaL', 'Bella', 'Thank you for calling SohamYoga. For class schedules, press 1. For bookings, press 2.', 'en', 'eleven_turbo_v2', 88, 4.60, 'phone_ivr', 'done')
    `);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureSchema();
    const pool = getPool();
    const { rows: generations } = await pool.query(
      'SELECT id, voice_id, voice_name, input_text, language, model_id, audio_url, character_count, duration_seconds, use_case, status, created_at FROM elevenlabs_generations ORDER BY created_at DESC LIMIT 100'
    );
    const hasApiKey = Boolean(process.env.ELEVENLABS_API_KEY);
    return Response.json({ generations, hasApiKey });
  } catch (err) {
    console.error('ElevenLabs GET error:', err);
    return Response.json({ error: 'Failed to load generations.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureSchema();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { voice_id, text, use_case = 'general', model_id = 'eleven_multilingual_v2', voice_name } = body as Record<string, string>;

    if (!voice_id || typeof voice_id !== 'string') {
      return Response.json({ error: 'voice_id is required.' }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return Response.json({ error: 'text is required.' }, { status: 400 });
    }
    if (text.length > 5000) {
      return Response.json({ error: 'Text exceeds 5000 character limit.' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      // Demo mode — log attempt without audio
      const pool = getPool();
      await pool.query(
        `INSERT INTO elevenlabs_generations (voice_id, voice_name, input_text, character_count, use_case, model_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'demo')`,
        [voice_id, voice_name || null, text.trim(), text.trim().length, use_case, model_id]
      );
      return Response.json({
        warning: 'ElevenLabs not configured. Add ELEVENLABS_API_KEY to .env.local',
        demo: true,
        audio_base64: null,
      });
    }

    // Real API call
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text().catch(() => 'Unknown error');
      console.error('ElevenLabs API error:', elevenRes.status, errText);
      return Response.json({ error: `ElevenLabs API error: ${elevenRes.status}` }, { status: 502 });
    }

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    const audio_base64 = audioBuffer.toString('base64');

    // Estimate duration from file size (~16kbps mp3)
    const durationSeconds = parseFloat((audioBuffer.length / 2000).toFixed(2));

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO elevenlabs_generations (voice_id, voice_name, input_text, character_count, use_case, model_id, audio_base64, duration_seconds, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'done')
       RETURNING id, created_at`,
      [voice_id, voice_name || null, text.trim(), text.trim().length, use_case, model_id, audio_base64, durationSeconds]
    );

    return Response.json({
      ok: true,
      id: rows[0].id,
      audio_base64,
      duration_seconds: durationSeconds,
      character_count: text.trim().length,
      created_at: rows[0].created_at,
    });
  } catch (err) {
    console.error('ElevenLabs POST error:', err);
    return Response.json({ error: 'Generation failed.' }, { status: 500 });
  }
}
