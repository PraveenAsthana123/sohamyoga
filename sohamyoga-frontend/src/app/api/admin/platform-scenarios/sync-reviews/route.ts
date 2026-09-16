import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { streamOllamaChat, type ChatMessage } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ollamaComplete(messages: ChatMessage[]): Promise<string> {
  let out = '';
  for await (const chunk of streamOllamaChat(messages)) out += chunk;
  return out.trim();
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });

  const rows = await query(
    `SELECT id, body FROM platform_review WHERE sentiment IS NULL LIMIT 50`
  );

  let classified = 0;
  for (const row of rows.rows) {
    try {
      const text = await ollamaComplete([
        { role: 'system', content: 'Classify the sentiment of this review. Respond with exactly one word: positive, neutral, or negative.' },
        { role: 'user', content: (row.body as string).substring(0, 500) },
      ]);
      const sentiment = ['positive','neutral','negative'].includes(text) ? text : 'neutral';
      const score = sentiment === 'positive' ? 0.7 : sentiment === 'negative' ? -0.7 : 0.0;
      await query(
        `UPDATE platform_review SET sentiment=$1, sentiment_score=$2 WHERE id=$3`,
        [sentiment, score, row.id]
      );
      classified++;
    } catch { /* skip on Ollama error */ }
  }

  return Response.json({ success: true, classified, total: rows.rowCount });
}
