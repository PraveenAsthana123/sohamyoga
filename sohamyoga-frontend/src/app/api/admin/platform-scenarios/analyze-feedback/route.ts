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

  const { platform, external_post_id } = await req.json() as { platform: string; external_post_id: string };
  if (!platform || !external_post_id) {
    return Response.json({ error: 'platform and external_post_id required' }, { status: 400 });
  }

  const rows = await query(
    `SELECT top_comments, sentiment_breakdown FROM platform_content_feedback
     WHERE platform=$1 AND external_post_id=$2 LIMIT 1`,
    [platform, external_post_id]
  );
  if (!rows.rows.length) return Response.json({ error: 'Feedback not found' }, { status: 404 });

  const { top_comments, sentiment_breakdown } = rows.rows[0] as {
    top_comments: Array<{ author: string; text: string; likes: number; is_negative: boolean }>;
    sentiment_breakdown: Record<string, number>;
  };

  const commentsText = (top_comments ?? []).slice(0, 20).map((c, i) => `${i+1}. "${c.text}" (${c.likes} likes)`).join('\n');

  type AnalysisResult = { classification: string; summary: string; breakdown: Record<string, number> };
  let analysis: AnalysisResult | null = null;
  try {
    const raw = await ollamaComplete([
      { role: 'system', content: 'You are a social media sentiment analyst. Analyze the comments and return valid JSON only: {"classification":"positive|neutral|negative","summary":"2 sentence summary","breakdown":{"positive":N,"neutral":N,"negative":N}}' },
      { role: 'user', content: `Platform: ${platform}\nComments:\n${commentsText}\nExisting breakdown: ${JSON.stringify(sentiment_breakdown)}` },
    ]);
    // Extract JSON
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) analysis = JSON.parse(match[0]) as AnalysisResult;
  } catch { /* return raw on parse failure */ }

  if (analysis) {
    await query(
      `UPDATE platform_content_feedback SET sentiment_breakdown=$1 WHERE platform=$2 AND external_post_id=$3`,
      [JSON.stringify(analysis.breakdown), platform, external_post_id]
    );
  }

  return Response.json({ success: true, analysis });
}
