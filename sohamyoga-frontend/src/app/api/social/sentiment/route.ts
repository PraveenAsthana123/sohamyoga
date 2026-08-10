import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { classifySentiment } from '@/lib/sentiment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/social/sentiment — classify a piece of text right now (admin
// pastes a review/DM/comment) and log it. Works with zero connected social
// accounts — doesn't depend on Postiz having any live comments to read.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { text?: string } | null;
  if (!body?.text?.trim()) return Response.json({ error: 'text is required.' }, { status: 400 });
  if (body.text.length > 4000) return Response.json({ error: 'text must be 4000 characters or fewer.' }, { status: 400 });

  let result;
  try {
    result = await classifySentiment(body.text);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Classification failed.' }, { status: 502 });
  }

  await query(
    `INSERT INTO sentiment_log (source, text_content, sentiment, confidence, reason) VALUES ('manual',$1,$2,$3,$4)`,
    [body.text, result.sentiment, result.confidence, result.reason],
  );

  return Response.json(result);
}

// GET /api/social/sentiment — recent log, for the Social Portal's Sentiment tab.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const [rows, summary] = await Promise.all([
    query<{ id: string; source: string; platform: string | null; text_content: string; sentiment: string; confidence: string | null; reason: string; created_at: string }>(
      `SELECT id, source, platform, text_content, sentiment, confidence, reason, created_at
       FROM sentiment_log ORDER BY created_at DESC LIMIT 50`,
    ),
    query<{ sentiment: string; count: string }>(`SELECT sentiment, COUNT(*) AS count FROM sentiment_log GROUP BY sentiment`),
  ]);

  return Response.json({
    log: rows.rows.map(r => ({
      id: r.id, source: r.source, platform: r.platform ?? undefined, text: r.text_content,
      sentiment: r.sentiment, confidence: r.confidence ? Number(r.confidence) : undefined, reason: r.reason, createdAt: r.created_at,
    })),
    summary: Object.fromEntries(summary.rows.map(r => [r.sentiment, Number(r.count)])),
  });
}
