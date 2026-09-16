import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const id = parseInt(params.id, 10);
    const jobRow = await client.query('SELECT * FROM anim_repurpose_jobs WHERE id = $1', [id]);
    if (jobRow.rowCount === 0) return Response.json({ error: 'Repurpose job not found' }, { status: 404 });

    const job = jobRow.rows[0];
    const body = await req.json();
    const { video_title, video_duration_seconds = 120 } = body;

    const targetFormats = job.target_formats || [];
    const prompt = `You are a social media video strategist. Create a repurposing plan for this video:

Source Video: ${job.source_video}
Title: ${video_title || 'Animation/video content'}
Duration: ${video_duration_seconds} seconds
Target Formats: ${targetFormats.join(', ')}

For each target format, provide a specific repurposing plan:
- Which timestamp range to extract (start/end)
- What to include/exclude
- Platform-specific optimization tips
- Caption/text overlay recommendation
- Whether subtitles are needed

Return as a JSON array:
[
  {
    "format": "instagram_reel",
    "title": "30s Highlight Reel",
    "start_time": "00:00:15",
    "end_time": "00:00:45",
    "duration": 30,
    "platform": "instagram",
    "aspect_ratio": "9:16",
    "optimization": "Hook in first 3s, caption overlay, trending audio",
    "subtitles_needed": true,
    "caption_suggestion": "First line of ideal caption..."
  }
]

Return ONLY the JSON array.`;

    let plan: unknown[] = [];
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        const raw = data.response || '';
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) plan = JSON.parse(match[0]);
      }
    } catch { /* fallback */ }

    if (!plan.length) {
      const perFormat = Math.round(video_duration_seconds / Math.max(targetFormats.length, 1));
      plan = targetFormats.map((fmt: string, i: number) => {
        const start = i * perFormat;
        const platforms: Record<string, string> = { instagram_reel: 'instagram', youtube_short: 'youtube', tiktok: 'tiktok', linkedin_video: 'linkedin', instagram_story: 'instagram', twitter_gif: 'twitter' };
        const ratios: Record<string, string> = { instagram_reel: '9:16', youtube_short: '9:16', tiktok: '9:16', instagram_story: '9:16', linkedin_video: '16:9', twitter_gif: '1:1' };
        return {
          format: fmt,
          title: `${fmt.replace(/_/g, ' ')} version`,
          start_time: `00:${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
          end_time: `00:${String(Math.floor((start + perFormat) / 60)).padStart(2, '0')}:${String((start + perFormat) % 60).padStart(2, '0')}`,
          duration: perFormat,
          platform: platforms[fmt] || 'multi',
          aspect_ratio: ratios[fmt] || '16:9',
          optimization: 'Hook in first 3s, add text overlays for muted viewers, trending audio where applicable',
          subtitles_needed: true,
          caption_suggestion: `Check out this ${fmt.replace(/_/g, ' ')} version of our latest content...`,
        };
      });
    }

    await client.query(
      `UPDATE anim_repurpose_jobs SET output_summary = $1, status = 'in_progress' WHERE id = $2`,
      [JSON.stringify(plan), id]
    );

    return Response.json({ plan, generated: true });
  } finally {
    client.release();
  }
}
