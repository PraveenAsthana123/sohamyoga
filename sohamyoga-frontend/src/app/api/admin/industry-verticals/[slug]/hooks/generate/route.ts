export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const platform = typeof body.platform === 'string' ? body.platform : 'Instagram';
  const { slug } = params;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM industry_verticals WHERE slug = $1', [slug]);
    if (!rows.length) return Response.json({ error: 'Vertical not found.' }, { status: 404 });

    const v = rows[0] as {
      name: string; target_audience: string; typical_pain_points: string[];
    };

    const prompt = `You are an expert social media copywriter specialising in scroll-stopping hooks. Generate 5 unique, high-performing content hooks for ${platform} for the following business vertical:

Vertical: ${v.name}
Target Audience: ${v.target_audience}
Pain Points: ${(v.typical_pain_points ?? []).join(', ')}

Requirements:
- Each hook must be a scroll-stopping first line (the text someone sees before clicking "more")
- Maximum 150 characters per hook
- Each hook should use a different psychological trigger: curiosity, social proof, pain point agitation, outcome/benefit, contrarian/counter-intuitive
- Make them platform-native for ${platform}
- Do NOT use generic filler — every word must earn its place

Format your response as:
HOOK 1 [trigger_type]: [hook text]
HOOK 2 [trigger_type]: [hook text]
HOOK 3 [trigger_type]: [hook text]
HOOK 4 [trigger_type]: [hook text]
HOOK 5 [trigger_type]: [hook text]`;

    let generatedText = '';
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        generatedText = data.response ?? '';
      }
    } catch {
      generatedText = '';
    }

    // Parse generated hooks or use fallbacks
    const hookLines = generatedText
      ? generatedText.split('\n').filter(l => /^HOOK \d/i.test(l.trim()))
      : [];

    const fallbackHooks = [
      { hook_type: 'curiosity', text: `The thing no one tells you about ${v.name.toLowerCase()} until it's too late.` },
      { hook_type: 'pain_point', text: `Still struggling with the same ${(v.typical_pain_points?.[0] ?? 'problem').toLowerCase()}? Read this.` },
      { hook_type: 'outcome', text: `How businesses in ${v.name} are getting 3x results with one simple change.` },
      { hook_type: 'social_proof', text: `What our top-performing ${v.name.toLowerCase()} clients all have in common.` },
      { hook_type: 'contrarian', text: `The popular advice about ${v.name.toLowerCase()} marketing that's actually hurting your results.` },
    ];

    const saved: unknown[] = [];
    if (hookLines.length >= 5) {
      for (const line of hookLines.slice(0, 5)) {
        const match = line.match(/^HOOK \d+\s*\[?([^\]:]*)\]?:\s*(.+)$/i);
        const hookType = match ? match[1].trim().toLowerCase().replace(/\s+/g, '_') : 'ai_generated';
        const hookText = match ? match[2].trim() : line.replace(/^HOOK \d+[:\s]*/i, '').trim();
        if (!hookText) continue;
        const { rows: r } = await client.query(
          `INSERT INTO vertical_content_hooks (vertical_slug, hook_type, hook_text, platform, performance_score)
           VALUES ($1,$2,$3,$4,3) RETURNING *`,
          [slug, hookType, hookText, platform],
        );
        saved.push(r[0]);
      }
    } else {
      for (const fb of fallbackHooks) {
        const { rows: r } = await client.query(
          `INSERT INTO vertical_content_hooks (vertical_slug, hook_type, hook_text, platform, performance_score)
           VALUES ($1,$2,$3,$4,3) RETURNING *`,
          [slug, fb.hook_type, fb.text, platform],
        );
        saved.push(r[0]);
      }
    }

    return Response.json({ hooks: saved, generated: hookLines.length >= 5 });
  } finally {
    client.release();
  }
}
