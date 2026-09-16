import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { project_name, video_topic, platform = 'youtube', target_audience } = body;
    if (!project_name || !video_topic) return Response.json({ error: 'project_name and video_topic are required' }, { status: 400 });

    const prompt = `You are a YouTube/social media thumbnail design expert. Generate 3 different thumbnail concept descriptions for this video:

Video Topic: ${video_topic}
Platform: ${platform}
Target Audience: ${target_audience || 'General audience'}

For each concept, provide:
- Style name (e.g., "bold_text", "lifestyle", "minimalist", "urgency", "face_forward")
- Text overlay: exact text to display on thumbnail (max 6 words)
- Visual style: brief description of the image composition
- Color scheme: primary + accent colors
- CTA element: any badge, arrow, or UI element to include
- Estimated CTR score (6.0-9.5 scale)

Return as a JSON array of exactly 3 objects:
[
  {
    "style": "bold_text",
    "text_overlay": "Master Yoga in 30 Days",
    "visual_style": "Instructor in power pose, dramatic lighting",
    "color_scheme": "Dark navy background, bright yellow text",
    "cta_element": "Red FREE badge top-right corner",
    "ctr_score": 8.2,
    "notes": "High contrast works well for wellness niche"
  }
]

Return ONLY the JSON array.`;

    let concepts: { style: string; text_overlay: string; visual_style: string; color_scheme: string; cta_element: string; ctr_score: number; notes: string }[] = [];
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
        if (match) concepts = JSON.parse(match[0]);
      }
    } catch { /* fallback */ }

    if (!concepts.length) {
      concepts = [
        { style: 'bold_text', text_overlay: `${video_topic.slice(0, 30)}`, visual_style: 'Subject in confident pose, high contrast lighting', color_scheme: 'Dark background, white bold text, accent color', cta_element: 'Watch Now arrow overlay', ctr_score: 7.8, notes: 'Bold text style typically drives 15-20% higher CTR' },
        { style: 'lifestyle', text_overlay: `Transform with ${video_topic.split(' ')[0]}`, visual_style: 'Authentic behind-the-scenes or lifestyle shot, warm tones', color_scheme: 'Warm golden palette, natural colors', cta_element: 'Subtle brand logo bottom-right', ctr_score: 6.9, notes: 'Authentic feel resonates with wellness audience' },
        { style: 'urgency', text_overlay: 'Start FREE Today', visual_style: 'Clean background, subject looking directly at camera', color_scheme: 'Orange/red urgency color, clean white text', cta_element: 'LIMITED SPOTS badge top-left', ctr_score: 8.6, notes: 'Urgency framing boosts click rate on challenge content' },
      ];
    }

    const inserted = [];
    for (const concept of concepts) {
      const fullPrompt = `${concept.visual_style} | Text: "${concept.text_overlay}" | Colors: ${concept.color_scheme} | CTA: ${concept.cta_element}`;
      const result = await client.query(
        `INSERT INTO pp_thumbnail_assets (project_name, style, prompt, platform, ctr_score, status, notes)
         VALUES ($1, $2, $3, $4, $5, 'generated', $6) RETURNING *`,
        [project_name, concept.style, fullPrompt, platform, concept.ctr_score, concept.notes]
      );
      inserted.push({ ...result.rows[0], concept });
    }

    return Response.json({ thumbnails: inserted, generated: true }, { status: 201 });
  } finally {
    client.release();
  }
}
