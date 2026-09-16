// HashtagTrendJob — Daily 07:00 UTC (0 7 * * *)
// For the top 20 hashtags in social_hashtag_performance per platform,
// uses Ollama to regenerate a trending_score based on post_count_this_week
// vs avg_reach. Produces advisory scores only — never modifies published
// content or removes hashtag data.

import { Pool } from 'pg';
import { ollama } from '../OllamaClient';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

interface HashtagRow {
  id: string;
  platform: string;
  hashtag: string;
  niche: string;
  avg_reach: number;
  avg_engagement: number;
  post_count_this_week: number;
  trending_score: number;
  competition_level: string;
}

function extractText(raw: string): string {
  return raw.trim().replace(/^```(?:json|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export async function run(): Promise<void> {
  const hashtags = await db.query<HashtagRow>(
    `SELECT id, platform, hashtag, niche, avg_reach, avg_engagement,
            post_count_this_week, trending_score, competition_level
     FROM social_hashtag_performance
     ORDER BY avg_reach DESC
     LIMIT 120`,
  ).catch(() => ({ rows: [] as HashtagRow[] }));

  let updated = 0;

  for (const tag of hashtags.rows) {
    try {
      const prompt = `Given this social media hashtag data, compute an updated trending_score (0-100):
Hashtag: #${tag.hashtag}
Platform: ${tag.platform}
Niche: ${tag.niche ?? 'general'}
Current avg_reach: ${tag.avg_reach}
Current avg_engagement: ${tag.avg_engagement}%
Post count this week: ${tag.post_count_this_week}
Previous trending_score: ${tag.trending_score}

Return a single JSON object: {"trending_score": <number 0-100>, "competition_level": "<low|medium|high>"}
No other text.`;

      const raw = await ollama.generate(prompt, { model: 'llama3.2', timeoutMs: 30000 });
      const text = extractText(raw);
      const parsed = JSON.parse(text);
      const newScore = Math.min(100, Math.max(0, Number(parsed.trending_score ?? tag.trending_score)));
      const newLevel = ['low', 'medium', 'high'].includes(parsed.competition_level)
        ? parsed.competition_level : tag.competition_level;

      await db.query(
        `UPDATE social_hashtag_performance SET trending_score = $1, competition_level = $2, last_analyzed_at = NOW() WHERE id = $3`,
        [newScore, newLevel, tag.id],
      );
      updated++;
    } catch {
      // Skip individual hashtag failures — continue with rest
    }
  }

  await db.query(
    `INSERT INTO job_run_log (job_name, status, detail, ran_at)
     VALUES ($1, 'ok', $2, NOW()) ON CONFLICT DO NOTHING`,
    ['hashtag-trend', `Updated ${updated}/${hashtags.rows.length} hashtag trending scores`],
  ).catch(() => {});

  console.log(`[hashtag-trend] updated=${updated} total=${hashtags.rows.length}`);
  await db.end().catch(() => {});
}
