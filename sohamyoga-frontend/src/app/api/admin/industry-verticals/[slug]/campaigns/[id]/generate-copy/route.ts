export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { slug: string; id: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const pool = getPool();
  const client = await pool.connect();
  try {
    const [vertRes, campRes] = await Promise.all([
      client.query('SELECT * FROM industry_verticals WHERE slug = $1', [params.slug]),
      client.query('SELECT * FROM vertical_campaigns WHERE id = $1 AND vertical_slug = $2', [params.id, params.slug]),
    ]);
    if (!vertRes.rows.length) return Response.json({ error: 'Vertical not found.' }, { status: 404 });
    if (!campRes.rows.length) return Response.json({ error: 'Campaign not found.' }, { status: 404 });

    const v = vertRes.rows[0] as { name: string; target_audience: string };
    const c = campRes.rows[0] as {
      campaign_name: string; campaign_type: string; target_segment: string;
      budget_estimate: number; expected_roas: number; channels: string[];
    };

    const prompt = `You are an expert direct-response copywriter. Write ad copy for this campaign:

Vertical: ${v.name}
Campaign Name: ${c.campaign_name}
Campaign Type: ${c.campaign_type}
Target Segment: ${c.target_segment}
Channels: ${(c.channels ?? []).join(', ')}
Budget: $${c.budget_estimate} | Expected ROAS: ${c.expected_roas}x

Generate 3 complete ad variations. For each variation provide:
**Variation [N]:**
HEADLINE (max 30 chars): [headline]
BODY COPY (max 125 chars): [body]
CTA (max 15 chars): [call-to-action]
NOTES: [brief rationale — why this angle works]

Make the copy specific, compelling, and conversion-focused for the ${c.campaign_type} format.`;

    let copyContent: string;
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        copyContent = data.response ?? '[No response from Ollama]';
      } else {
        copyContent = `[Ollama unavailable]\n\nVariation 1:\nHEADLINE: ${c.campaign_name}\nBODY: Reach ${c.target_segment} with targeted ${c.campaign_type} messaging.\nCTA: Learn More\n\nVariation 2:\nHEADLINE: See Results Fast\nBODY: Join thousands who chose ${v.name} solutions. Start today.\nCTA: Get Started\n\nVariation 3:\nHEADLINE: Limited Time Offer\nBODY: Don't miss out — this campaign is designed specifically for ${c.target_segment}.\nCTA: Claim Now`;
      }
    } catch {
      copyContent = `[Ollama timeout]\n\nVariation 1:\nHEADLINE: ${c.campaign_name}\nBODY: Targeted offer for ${c.target_segment}.\nCTA: Learn More`;
    }

    await client.query(
      'UPDATE vertical_campaigns SET generated_copy = $1 WHERE id = $2',
      [copyContent, params.id],
    );

    return Response.json({ copy: copyContent });
  } finally {
    client.release();
  }
}
