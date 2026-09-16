// AIContentAdaptJob — every 2 hours
// Picks up pending platform_ai_content_job records,
// calls Ollama llama3.2 for each target platform, stores results, marks done.

import { Pool } from 'pg';

const db = new Pool({ connectionString: process.env.DATABASE_URL });

const PLATFORM_ADAPT_CONFIG: Record<string, { charLimit: number; bestPractices: string; tone: string }> = {
  twitter:   { charLimit: 280,    bestPractices: 'Use 1-2 hashtags, be concise, add a hook',     tone: 'casual, punchy' },
  linkedin:  { charLimit: 3000,   bestPractices: 'Professional tone, add insights, use line breaks', tone: 'professional, thoughtful' },
  instagram: { charLimit: 2200,   bestPractices: 'Use 5-10 hashtags, storytelling, emoji',        tone: 'visual, inspiring' },
  facebook:  { charLimit: 63206,  bestPractices: 'Conversational, ask questions, tag people',     tone: 'friendly, community' },
  tiktok:    { charLimit: 2200,   bestPractices: 'Trend-aware, calls to action, hashtags',        tone: 'energetic, fun' },
  pinterest: { charLimit: 500,    bestPractices: 'Descriptive, keyword-rich, inspirational',      tone: 'aspirational' },
  reddit:    { charLimit: 40000,  bestPractices: 'Authentic, community-first, no hard sell',      tone: 'genuine, informative' },
  medium:    { charLimit: 100000, bestPractices: 'Long-form, structured, SEO-friendly headers',   tone: 'thoughtful, detailed' },
  whatsapp:  { charLimit: 4096,   bestPractices: 'Personal, direct, use lists for clarity',       tone: 'warm, personal' },
  default:   { charLimit: 2000,   bestPractices: 'Clear, engaging, platform-appropriate',         tone: 'professional' },
};

async function adaptContent(
  sourceContent: string,
  sourcePlatform: string,
  targetPlatform: string,
  jobType: string
): Promise<string> {
  const config = PLATFORM_ADAPT_CONFIG[targetPlatform] ?? PLATFORM_ADAPT_CONFIG.default;

  let taskInstruction: string;
  switch (jobType) {
    case 'repurpose':
      taskInstruction = `Repurpose and creatively reframe the following content for ${targetPlatform}.`;
      break;
    case 'hashtag':
      taskInstruction = `Generate the best hashtags for ${targetPlatform} based on the following content. Return only the hashtags, space-separated.`;
      break;
    case 'caption':
      taskInstruction = `Write a compelling caption for ${targetPlatform} based on the following content.`;
      break;
    case 'best_time':
      taskInstruction = `Suggest the best day and time to post on ${targetPlatform} based on the content type. Keep it brief.`;
      break;
    default:
      taskInstruction = `Adapt the following content for ${targetPlatform}.`;
  }

  const prompt = `You are a social media expert. ${taskInstruction}
Original content (for ${sourcePlatform}): ${sourceContent}

Platform requirements:
- Character limit: ${config.charLimit}
- Best practices: ${config.bestPractices}
- Tone: ${config.tone}

Return ONLY the adapted content text, nothing else.`;

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}`);
  }

  const data = await response.json() as { response: string };
  const adapted = data.response?.trim() ?? '';
  return adapted.length > config.charLimit ? adapted.slice(0, config.charLimit - 3) + '...' : adapted;
}

interface JobRow {
  id: number;
  source_content: string;
  source_platform: string;
  target_platforms: string;
  job_type: string;
}

export async function run(): Promise<void> {
  console.log(`[AIContentAdaptJob] Starting at ${new Date().toISOString()}`);

  const jobsResult = await db.query<JobRow>(
    `SELECT id, source_content, source_platform, target_platforms, job_type
     FROM platform_ai_content_job
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 20`
  );

  const jobs = jobsResult.rows;
  console.log(`[AIContentAdaptJob] Found ${jobs.length} pending jobs`);

  for (const job of jobs) {
    // Mark as running
    await db.query(
      `UPDATE platform_ai_content_job SET status = 'running' WHERE id = $1`,
      [job.id]
    );

    const targetPlatforms = job.target_platforms.split(',').map((p: string) => p.trim()).filter(Boolean);
    const aiResult: Record<string, string> = {};
    let hasError = false;

    for (const platform of targetPlatforms) {
      try {
        const adapted = await adaptContent(
          job.source_content,
          job.source_platform,
          platform,
          job.job_type
        );
        aiResult[platform] = adapted;
        console.log(`[AIContentAdaptJob] Job ${job.id}: adapted for ${platform} (${adapted.length} chars)`);
      } catch (e) {
        console.error(`[AIContentAdaptJob] Job ${job.id}: failed for ${platform}:`, e);
        aiResult[platform] = `[Error: ${String(e)}]`;
        hasError = true;
      }
    }

    const finalStatus = hasError ? 'failed' : 'done';
    await db.query(
      `UPDATE platform_ai_content_job
       SET status=$1, ai_result=$2, completed_at=NOW()
       WHERE id=$3`,
      [finalStatus, JSON.stringify(aiResult), job.id]
    );
  }

  console.log(`[AIContentAdaptJob] Done. Processed ${jobs.length} jobs.`);
  await db.end();
}
