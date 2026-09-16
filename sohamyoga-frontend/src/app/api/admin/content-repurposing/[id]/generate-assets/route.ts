export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

const CHANNEL_FORMATS: Record<string, { asset_type: string; format: string; instructions: string }> = {
  Blog: { asset_type: 'article', format: 'long-form', instructions: '600-word SEO blog post with H2 headings and a CTA at the end' },
  Newsletter: { asset_type: 'newsletter', format: 'email', instructions: '250-word email newsletter with subject line, intro, 3 bullet points, and CTA' },
  LinkedIn: { asset_type: 'post', format: 'text', instructions: '150-word LinkedIn post with a hook, 3 insights, and a question for engagement' },
  Twitter: { asset_type: 'tweet', format: 'text', instructions: '280-character tweet with emojis, hashtags, and a CTA' },
  Instagram: { asset_type: 'reel', format: '9:16', instructions: '30-second reel script with hook, 3 scenes, and CTA' },
  TikTok: { asset_type: 'tiktok', format: '9:16', instructions: '60-second TikTok script with trending hook, value points, and CTA' },
  'YouTube Short': { asset_type: 'short', format: '9:16', instructions: '60-second YouTube Short script with hook in first 3 seconds, value delivery, and subscribe CTA' },
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });

  const body = await req.json();
  const { target_channels, source_transcript } = body as { target_channels: string[]; source_transcript?: string };
  if (!target_channels || !target_channels.length) return Response.json({ error: 'target_channels is required' }, { status: 400 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM repurpose_projects WHERE id=$1', [params.id]);
    if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
    const project = rows[0] as { title: string; source_type: string; goals: string[] };

    const created: { platform: string; title: string; status: string }[] = [];

    for (const channel of target_channels) {
      const cfg = CHANNEL_FORMATS[channel];
      if (!cfg) continue;

      const contextNote = source_transcript ? `Based on this content excerpt: "${source_transcript.slice(0, 400)}"` : '';
      const prompt = `You are a content repurposing specialist for a yoga and wellness brand. Create a ${channel} asset for the project titled "${project.title}". ${contextNote}\n\nWrite a ${cfg.instructions}. The tone should be warm, expert, and community-oriented. Respond with ONLY the content, no preamble.`;

      let content = `[${channel} content for ${project.title}] — Generated draft pending Ollama response. This would be a ${cfg.instructions} formatted appropriately for ${channel} audiences.`;
      let title = `${project.title} — ${channel}`;

      try {
        const ollamaRes = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
          signal: AbortSignal.timeout(30000),
        });
        if (ollamaRes.ok) {
          const data = await ollamaRes.json() as { response?: string };
          if (data.response) {
            content = data.response.trim();
            const firstLine = content.split('\n')[0].replace(/^[#*\-]+\s*/, '').trim();
            if (firstLine.length > 0 && firstLine.length < 120) title = firstLine;
          }
        }
      } catch { /* use fallback */ }

      const { rows: inserted } = await client.query(`
        INSERT INTO repurpose_assets (project_id, asset_type, title, platform, format, content, status)
        VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING id, platform, title, status
      `, [params.id, cfg.asset_type, title, channel, cfg.format, content]);

      created.push(inserted[0] as { platform: string; title: string; status: string });
    }

    return Response.json({ created_count: created.length, assets: created });
  } finally {
    client.release();
  }
}
