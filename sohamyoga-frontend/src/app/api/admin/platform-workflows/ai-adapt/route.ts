import { NextRequest } from 'next/server';
import { query } from '@/lib/postgres';

import { requireAdmin } from '@/lib/admin-auth';
const PLATFORM_ADAPT_CONFIG: Record<string, { charLimit: number; bestPractices: string; tone: string }> = {
  twitter:   { charLimit: 280,    bestPractices: 'Use 1-2 hashtags, be concise, add a hook',                          tone: 'casual, punchy' },
  linkedin:  { charLimit: 3000,   bestPractices: 'Professional tone, add insights, use line breaks',                  tone: 'professional, thoughtful' },
  instagram: { charLimit: 2200,   bestPractices: 'Use 5-10 hashtags, storytelling, emoji',                            tone: 'visual, inspiring' },
  facebook:  { charLimit: 63206,  bestPractices: 'Conversational, ask questions, tag people',                         tone: 'friendly, community' },
  tiktok:    { charLimit: 2200,   bestPractices: 'Trend-aware, calls to action, hashtags',                            tone: 'energetic, fun' },
  pinterest: { charLimit: 500,    bestPractices: 'Descriptive, keyword-rich, inspirational',                          tone: 'aspirational' },
  reddit:    { charLimit: 40000,  bestPractices: 'Authentic, community-first, no hard sell',                          tone: 'genuine, informative' },
  medium:    { charLimit: 100000, bestPractices: 'Long-form, structured, SEO-friendly headers',                       tone: 'thoughtful, detailed' },
  whatsapp:  { charLimit: 4096,   bestPractices: 'Personal, direct, use lists for clarity',                           tone: 'warm, personal' },
  default:   { charLimit: 2000,   bestPractices: 'Clear, engaging, platform-appropriate',                             tone: 'professional' },
};

async function adaptForPlatform(
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
      taskInstruction = `Analyze the following content and suggest the best day and time to post on ${targetPlatform} and why. Keep it brief.`;
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
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json() as { response: string };
  const adapted = data.response?.trim() ?? '';

  // Enforce character limit
  if (adapted.length > config.charLimit) {
    return adapted.slice(0, config.charLimit - 3) + '...';
  }
  return adapted;
}

export async function POST(req: NextRequest) {

  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const body = await req.json() as {
      source_content: string;
      source_platform: string;
      target_platforms: string[];
      job_type?: string;
    };

    const { source_content, source_platform, target_platforms, job_type = 'adapt' } = body;

    if (!source_content || !target_platforms || target_platforms.length === 0) {
      return Response.json(
        { error: 'source_content and target_platforms are required' },
        { status: 400 }
      );
    }

    // Create job record
    const jobResult = await query<{ id: number }>(
      `INSERT INTO platform_ai_content_job
         (source_content, source_platform, target_platforms, job_type, status)
       VALUES ($1,$2,$3,$4,'running') RETURNING id`,
      [source_content, source_platform, target_platforms.join(','), job_type]
    );
    const jobId = jobResult.rows[0].id;

    const aiResult: Record<string, string> = {};
    const errors: Record<string, string> = {};

    // Adapt for each platform
    for (const platform of target_platforms) {
      try {
        const adapted = await adaptForPlatform(source_content, source_platform, platform, job_type);
        aiResult[platform] = adapted;
      } catch (e) {
        errors[platform] = String(e);
        aiResult[platform] = `[Adaptation failed: ${String(e)}]`;
      }
    }

    // Update job record
    await query(
      `UPDATE platform_ai_content_job
       SET status='done', ai_result=$1, completed_at=NOW()
       WHERE id=$2`,
      [JSON.stringify(aiResult), jobId]
    );

    return Response.json({
      job_id: jobId,
      adapted: aiResult,
      errors,
      platforms_adapted: Object.keys(aiResult).length,
    });
  } catch (err) {
    console.error('AI adapt error:', err);
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
