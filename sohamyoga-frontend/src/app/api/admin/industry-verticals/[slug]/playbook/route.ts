export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool, databaseConfigured } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: { slug: string } }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'Database not configured.' }, { status: 503 });

  const { slug } = params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM industry_verticals WHERE slug = $1', [slug]);
    if (!rows.length) return Response.json({ error: 'Vertical not found.' }, { status: 404 });

    const v = rows[0] as {
      name: string; target_audience: string; revenue_models: string[];
      key_channels: string[]; typical_pain_points: string[]; avg_deal_size: number;
    };

    const prompt = `You are a senior digital marketing strategist. Create a comprehensive 90-day marketing playbook for the following business vertical:

Vertical: ${v.name}
Target Audience: ${v.target_audience}
Revenue Models: ${(v.revenue_models ?? []).join(', ')}
Key Channels: ${(v.key_channels ?? []).join(', ')}
Typical Pain Points: ${(v.typical_pain_points ?? []).join(', ')}
Average Deal Size: $${v.avg_deal_size}

Produce a detailed playbook covering:
1. EXECUTIVE SUMMARY (2-3 sentences on strategy focus)
2. 90-DAY PHASE PLAN
   - Phase 1 (Days 1-30): Foundation & Quick Wins
   - Phase 2 (Days 31-60): Scale & Optimize
   - Phase 3 (Days 61-90): Retention & Expansion
3. TOP 3 CAMPAIGNS TO LAUNCH (name, objective, channel mix, estimated budget, expected ROAS, 30-day KPIs)
4. CONTENT CALENDAR STRUCTURE (weekly content types by platform, posting frequency, content mix %)
5. BUDGET ALLOCATION RECOMMENDATION (% per channel, rationale)
6. KEY METRICS TO TRACK (with target benchmarks for this vertical)
7. QUICK WINS FOR FIRST 30 DAYS (3-5 specific tactics)

Be specific, practical, and data-driven. Use real benchmarks for this industry vertical.`;

    let playbookContent: string;
    try {
      const ollamaRes = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { response?: string };
        playbookContent = data.response ?? '';
      } else {
        playbookContent = `[Ollama unavailable — fallback playbook for ${v.name}]\n\n90-Day Strategy Overview:\n\nPhase 1 (Days 1-30): Set up tracking, audit existing channels, launch 1-2 core campaigns targeting ${v.target_audience}.\n\nPhase 2 (Days 31-60): Optimize top performers, A/B test creative, expand to secondary channels: ${(v.key_channels ?? []).join(', ')}.\n\nPhase 3 (Days 61-90): Retargeting, loyalty/retention campaigns, expand lookalike audiences.\n\nBudget: Focus 60% on top 2 channels, 20% on content/creative, 20% on testing.\n\nKey metrics: CPL, CAC, ROAS, retention rate.`;
      }
    } catch {
      playbookContent = `[Ollama timeout — fallback playbook for ${v.name}]\n\nCore Strategy: Focus on ${(v.key_channels ?? []).slice(0, 3).join(', ')} to reach ${v.target_audience}. Average deal size of $${v.avg_deal_size} means even a 3-4x ROAS justifies paid investment. Address pain points: ${(v.typical_pain_points ?? []).slice(0, 2).join('; ')}.\n\nRun a full audit before spending. Quick win: optimize Google My Business / profile completeness first.`;
    }

    const { rows: reportRows } = await client.query(
      `INSERT INTO vertical_reports (vertical_slug, report_name, report_type, content, generated_by)
       VALUES ($1, $2, 'playbook', $3, 'ai') RETURNING *`,
      [slug, `90-Day Playbook — ${v.name} — ${new Date().toLocaleDateString()}`, playbookContent],
    );

    return Response.json({ report: reportRows[0] });
  } finally {
    client.release();
  }
}
