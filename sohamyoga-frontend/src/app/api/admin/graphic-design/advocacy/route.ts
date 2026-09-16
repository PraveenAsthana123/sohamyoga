import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const result = await getPool().query(
    `SELECT * FROM employee_advocacy_posts ORDER BY created_at DESC`
  );

  const stats = await getPool().query(
    `SELECT COALESCE(SUM(shared_count),0) AS total_shared, COALESCE(SUM(reach),0) AS total_reach FROM employee_advocacy_posts`
  );

  return Response.json({
    posts: result.rows,
    stats: {
      total_shared: parseInt(stats.rows[0].total_shared),
      total_reach: parseInt(stats.rows[0].total_reach),
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request.' }, { status: 400 });

  // AI generate advocacy posts
  if (body.action === 'ai_generate') {
    const prompt = `Write 3 LinkedIn employee advocacy post variations for a digital marketing agency. Include: professional insight, personal angle, relevant hashtags. Keep under 300 chars each. Format each as: POST 1: [text] | POST 2: [text] | POST 3: [text]`;
    let generated = '';
    try {
      const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
        signal: AbortSignal.timeout(45_000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        generated = data.response?.trim() || '';
      }
    } catch {
      // fallback below
    }
    if (!generated) {
      generated = `POST 1: Digital marketing isn't just about clicks — it's about connection. Every campaign we run is a chance to tell a brand's story authentically. #DigitalMarketing #ContentStrategy #AgencyLife\n\nPOST 2: 3 years in digital marketing taught me: data tells you what happened, creativity tells you what to try next. Balance both. #MarketingTips #Growth #Creativity\n\nPOST 3: The best marketing doesn't feel like marketing. It feels like a conversation. That's what we build every day at our agency. #Marketing #BrandStory #Authenticity`;
    }
    return Response.json({ ok: true, generated });
  }

  // update status / share_count
  if (body.action === 'update_status' && body.id) {
    const result = await getPool().query(
      `UPDATE employee_advocacy_posts SET status = $2 WHERE id = $1 RETURNING *`,
      [body.id, body.status || 'approved']
    );
    if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ ok: true, post: result.rows[0] });
  }

  if (body.action === 'increment_share' && body.id) {
    const result = await getPool().query(
      `UPDATE employee_advocacy_posts SET shared_count = shared_count + 1, reach = reach + $2 WHERE id = $1 RETURNING *`,
      [body.id, body.estimated_reach || 150]
    );
    if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ ok: true, post: result.rows[0] });
  }

  // create new post
  if (!body.title || !body.content) {
    return Response.json({ error: 'title and content are required.' }, { status: 400 });
  }

  const result = await getPool().query(
    `INSERT INTO employee_advocacy_posts (title, content, platform, image_url, suggested_caption, hashtags)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [body.title, body.content, body.platform || 'linkedin', body.image_url || null,
     body.suggested_caption || null, body.hashtags || null]
  );

  return Response.json({ ok: true, post: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database unavailable.' }, { status: 503 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !body.id) return Response.json({ error: 'id is required.' }, { status: 400 });

  if (body.action === 'increment_share') {
    const result = await getPool().query(
      `UPDATE employee_advocacy_posts SET shared_count = shared_count + 1, reach = reach + $2 WHERE id = $1 RETURNING *`,
      [body.id, body.estimated_reach || 150]
    );
    if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
    return Response.json({ ok: true, post: result.rows[0] });
  }

  const result = await getPool().query(
    `UPDATE employee_advocacy_posts SET
      status = COALESCE($2, status),
      title = COALESCE($3, title),
      content = COALESCE($4, content),
      hashtags = COALESCE($5, hashtags)
     WHERE id = $1 RETURNING *`,
    [body.id, body.status ?? null, body.title ?? null, body.content ?? null, body.hashtags ?? null]
  );
  if (!result.rowCount) return Response.json({ error: 'Not found.' }, { status: 404 });
  return Response.json({ ok: true, post: result.rows[0] });
}
