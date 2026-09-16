import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { databaseConfigured, query } from '@/lib/postgres';
import { streamOllamaChat, OLLAMA_MODEL, type ChatMessage } from '@/lib/ollama';
import { ensureSchema } from '@/lib/platform-scenarios-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ollamaComplete(messages: ChatMessage[]): Promise<string> {
  let out = '';
  for await (const chunk of streamOllamaChat(messages)) out += chunk;
  return out.trim();
}

function periodLabel(period: string): string {
  const now = new Date();
  if (period === 'this_month') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (period === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  const q = Math.ceil((now.getMonth()+1)/3);
  return `${now.getFullYear()}-Q${q}`;
}

export async function POST(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  await ensureSchema();

  const { platform, insight_type, period } = await req.json() as { platform: string; insight_type: string; period: string };
  if (!platform || !insight_type || !period) {
    return Response.json({ error: 'platform, insight_type, period required' }, { status: 400 });
  }

  // Pull real analytics data if available
  const analytics = await query(
    `SELECT total_posts, total_impressions, total_reach, total_likes, avg_engagement_rate, follower_count
     FROM social_platform_analytics WHERE platform=$1 ORDER BY period DESC LIMIT 3`,
    [platform]
  ).catch(() => ({ rows: [] }));

  const analyticsText = analytics.rows.length
    ? analytics.rows.map((r: Record<string, unknown>) =>
        `Posts: ${r.total_posts}, Impressions: ${r.total_impressions}, Likes: ${r.total_likes}, EngRate: ${r.avg_engagement_rate}%, Followers: ${r.follower_count}`
      ).join(' | ')
    : 'No analytics data available yet.';

  const periodStr = periodLabel(period);

  let result: { title: string; summary: string; recommendations: Array<{ action: string; priority: string; expected_impact: string }> } | null = null;
  try {
    const raw = await ollamaComplete([
      {
        role: 'system',
        content: 'You are a social media analyst. Return valid JSON only, no markdown, no explanation.',
      },
      {
        role: 'user',
        content: `You are a social media analyst. Here is the ${platform} analytics data for ${periodStr}:\n${analyticsText}\n\nGenerate a ${insight_type} insight with:\n1) A summary of what\'s working and what isn\'t.\n2) Three specific actionable recommendations with expected impact.\n\nReturn as JSON: {"title":"...","summary":"...","recommendations":[{"action":"...","priority":"high|medium|low","expected_impact":"..."}]}`,
      },
    ]);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) result = JSON.parse(match[0]) as typeof result;
  } catch { /* fallback */ }

  if (!result) {
    result = {
      title: `${insight_type.replace(/_/g,' ')} insight for ${platform} (${periodStr})`,
      summary: 'Ollama analysis unavailable. Ensure Ollama is running and the model is loaded.',
      recommendations: [
        { action: 'Post consistently 3-5 times per week', priority: 'high', expected_impact: '+15% engagement' },
        { action: 'Use trending hashtags relevant to your niche', priority: 'medium', expected_impact: '+10% reach' },
        { action: 'Respond to all comments within 2 hours', priority: 'medium', expected_impact: '+8% retention' },
      ],
    };
  }

  const saved = await query(
    `INSERT INTO platform_insight (platform, insight_type, period, title, summary, data, recommendations, generated_by, model_used)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'ollama',$8)
     RETURNING id`,
    [platform, insight_type, periodStr, result.title, result.summary, JSON.stringify({ analytics_used: analyticsText }), JSON.stringify(result.recommendations), OLLAMA_MODEL]
  );

  return Response.json({ insight: { id: saved.rows[0].id, ...result, platform, insight_type, period: periodStr } });
}
