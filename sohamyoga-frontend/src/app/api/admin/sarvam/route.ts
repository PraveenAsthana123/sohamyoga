import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SARVAM_BASE = 'https://api.sarvam.ai';

const SUPPORTED_OPERATIONS = [
  {
    operation: 'translate',
    label: 'Translate',
    description: 'Translate text between Indian languages',
    endpoint: '/translate',
    method: 'POST',
  },
  {
    operation: 'transliterate',
    label: 'Transliterate',
    description: 'Convert Roman script to Indian scripts',
    endpoint: '/transliterate',
    method: 'POST',
  },
  {
    operation: 'tts',
    label: 'Text to Speech',
    description: 'Generate audio in Indian languages',
    endpoint: '/text-to-speech',
    method: 'POST',
  },
  {
    operation: 'stt',
    label: 'Speech to Text',
    description: 'Transcribe and translate spoken audio',
    endpoint: '/speech-to-text-translate',
    method: 'POST',
  },
  {
    operation: 'detect-language',
    label: 'Detect Language',
    description: 'Identify the language of input text',
    endpoint: '/detect-language',
    method: 'POST',
  },
];

async function ensureSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sarvam_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation TEXT NOT NULL,
      input_text TEXT,
      source_language TEXT,
      target_language TEXT,
      output_text TEXT,
      audio_base64 TEXT,
      model TEXT,
      status TEXT DEFAULT 'done',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*) AS cnt FROM sarvam_jobs');
  if (parseInt(rows[0].cnt, 10) === 0) {
    await pool.query(`
      INSERT INTO sarvam_jobs (operation, input_text, source_language, target_language, output_text, model, status)
      VALUES
        ('translate', 'Welcome to our yoga studio. We offer classes for all levels.', 'en-IN', 'hi-IN', 'हमारे योग स्टूडियो में आपका स्वागत है। हम सभी स्तरों के लिए कक्षाएं प्रदान करते हैं।', 'mayura:v1', 'done'),
        ('transliterate', 'Namaste, aap kaise hain?', 'en-IN', 'hi-IN', 'नमस्ते, आप कैसे हैं?', NULL, 'done'),
        ('translate', 'Book your session today and get 20% off your first month.', 'en-IN', 'ta-IN', 'இன்றே உங்கள் அமர்வை பதிவு செய்யுங்கள், உங்கள் முதல் மாதம் 20% தள்ளுபடி பெறுங்கள்.', 'mayura:v1', 'done'),
        ('detect-language', 'यह एक परीक्षण संदेश है।', NULL, NULL, 'hi-IN', NULL, 'done'),
        ('translate', 'Our certified instructors are available 7 days a week.', 'en-IN', 'bn-IN', 'আমাদের প্রত্যয়িত প্রশিক্ষকরা সপ্তাহে 7 দিন উপলব্ধ।', 'mayura:v1', 'done')
    `);
  }
}

// ── Demo responses ─────────────────────────────────────────────────────────────
function getDemoResponse(operation: string): Record<string, unknown> {
  switch (operation) {
    case 'translate':
      return { translated_text: '[Demo] Namaste! Yeh ek demo anuvad hai।', warning: 'Sarvam AI not configured. Add SARVAM_API_KEY to .env.local', demo: true };
    case 'transliterate':
      return { transliterated_text: '[Demo] नमस्ते! यह एक डेमो है।', warning: 'Sarvam AI not configured. Add SARVAM_API_KEY to .env.local', demo: true };
    case 'tts':
      return { audio_base64: null, warning: 'Connect API for real audio', demo: true };
    case 'stt':
      return { transcript: '[Demo] Speech transcription not available in demo mode.', demo: true };
    case 'detect-language':
      return { language_code: 'hi-IN', confidence: 0.97, demo: true };
    default:
      return { result: '[Demo] Operation not supported.', demo: true };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    await ensureSchema();
    const pool = getPool();
    const { rows: jobs } = await pool.query(
      'SELECT id, operation, input_text, source_language, target_language, output_text, model, status, created_at FROM sarvam_jobs ORDER BY created_at DESC LIMIT 100'
    );
    const hasApiKey = Boolean(process.env.SARVAM_API_KEY);
    return Response.json({ jobs, operations: SUPPORTED_OPERATIONS, hasApiKey });
  } catch (err) {
    console.error('Sarvam GET error:', err);
    return Response.json({ error: 'Failed to load Sarvam jobs.' }, { status: 500 });
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

    const {
      operation,
      input_text,
      source_language,
      target_language,
      speaker,
      pitch,
      pace,
      loudness,
      mode,
      enable_preprocessing,
    } = body as Record<string, unknown>;

    if (!operation || typeof operation !== 'string') {
      return Response.json({ error: 'operation is required.' }, { status: 400 });
    }

    const validOps = SUPPORTED_OPERATIONS.map(o => o.operation);
    if (!validOps.includes(operation)) {
      return Response.json({ error: `Unknown operation. Supported: ${validOps.join(', ')}` }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
      // Demo mode
      const demo = getDemoResponse(operation);
      const pool = getPool();
      const outputText = (demo.translated_text || demo.transliterated_text || demo.transcript || demo.language_code || null) as string | null;
      await pool.query(
        `INSERT INTO sarvam_jobs (operation, input_text, source_language, target_language, output_text, status)
         VALUES ($1, $2, $3, $4, $5, 'demo')`,
        [operation, input_text || null, source_language || null, target_language || null, outputText]
      );
      return Response.json(demo);
    }

    // Real API call
    const headers: Record<string, string> = {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    };

    let endpoint = '';
    let requestBody: Record<string, unknown> = {};

    switch (operation) {
      case 'translate':
        endpoint = '/translate';
        requestBody = {
          input: input_text,
          source_language_code: source_language || 'en-IN',
          target_language_code: target_language || 'hi-IN',
          ...(speaker ? { speaker_gender: speaker } : {}),
          ...(mode ? { mode } : {}),
          ...(enable_preprocessing !== undefined ? { enable_preprocessing } : {}),
        };
        break;

      case 'transliterate':
        endpoint = '/transliterate';
        requestBody = {
          input: input_text,
          source_language_code: source_language || 'en-IN',
          target_language_code: target_language || 'hi-IN',
        };
        break;

      case 'tts':
        endpoint = '/text-to-speech';
        requestBody = {
          inputs: [input_text],
          target_language_code: target_language || 'hi-IN',
          speaker: speaker || 'meera',
          ...(pitch !== undefined ? { pitch } : {}),
          ...(pace !== undefined ? { pace } : {}),
          ...(loudness !== undefined ? { loudness } : {}),
          ...(enable_preprocessing !== undefined ? { enable_preprocessing } : {}),
        };
        break;

      case 'stt':
        endpoint = '/speech-to-text-translate';
        requestBody = {
          file: body.audio_base64,
          model: 'saarika:v1',
          language_code: source_language || 'hi-IN',
        };
        break;

      case 'detect-language':
        endpoint = '/detect-language';
        requestBody = { input: input_text };
        break;

      default:
        return Response.json({ error: 'Unknown operation.' }, { status: 400 });
    }

    const sarvamRes = await fetch(`${SARVAM_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text().catch(() => 'Unknown error');
      console.error('Sarvam API error:', sarvamRes.status, errText);
      return Response.json({ error: `Sarvam API error: ${sarvamRes.status}`, detail: errText }, { status: 502 });
    }

    const result = await sarvamRes.json() as Record<string, unknown>;

    // Persist to DB
    const pool = getPool();
    const outputText = (result.translated_text || result.transliterated_text || result.transcript || result.language_code || null) as string | null;
    const audiosArr = Array.isArray(result.audios) ? result.audios : [];
    const audioBase64 = (audiosArr[0] || result.audio_base64 || null) as string | null;

    const { rows } = await pool.query(
      `INSERT INTO sarvam_jobs (operation, input_text, source_language, target_language, output_text, audio_base64, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'done')
       RETURNING id, created_at`,
      [operation, typeof input_text === 'string' ? input_text : null, source_language || null, target_language || null, outputText, audioBase64]
    );

    return Response.json({ ...result, id: rows[0].id, created_at: rows[0].created_at, ok: true });
  } catch (err) {
    console.error('Sarvam POST error:', err);
    return Response.json({ error: 'Sarvam operation failed.' }, { status: 500 });
  }
}
