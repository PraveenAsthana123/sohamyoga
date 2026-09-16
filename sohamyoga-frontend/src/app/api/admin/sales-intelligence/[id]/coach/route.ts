export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const { id } = await params;
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT * FROM sales_intel_deals WHERE id=$1', [id]);
    if (!rows[0]) return Response.json({ error: 'Not found' }, { status: 404 });
    const deal = rows[0];

    const prompt = `You are an expert B2B sales coach. Analyze this deal and provide coaching:
Company: ${deal.company}
Contact: ${deal.contact}
Deal Value: $${deal.value}
Stage: ${deal.stage}
Probability: ${deal.probability}%
Next Action: ${deal.next_action}
Notes: ${deal.ai_notes || 'None'}

Return JSON:
{
  "next_best_action": "specific action to take now",
  "risk_factors": ["risk1", "risk2"],
  "objection_handling": { "likely_objection": "...", "response_script": "..." },
  "competitive_positioning": "how to differentiate",
  "closing_strategy": "recommended path to close",
  "email_template": "a short email to send to the contact",
  "probability_assessment": 70
}`;

    let coaching: Record<string, unknown> = {};
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) coaching = JSON.parse(match[0]);
    } catch { /* fallback */ }

    const stageAdvice: Record<string, Record<string, unknown>> = {
      prospecting: { next_best_action: 'Send a personalized LinkedIn message + follow up with cold email referencing a mutual connection or recent company news', closing_strategy: 'Focus on discovery first — find pain points before pitching' },
      qualifying: { next_best_action: 'Book a 30-minute discovery call to confirm budget, authority, need, and timeline (BANT)', closing_strategy: 'Qualify hard now — better to disqualify early than late' },
      proposal: { next_best_action: 'Follow up on proposal with ROI calculator tailored to their headcount', closing_strategy: 'Create urgency with end-of-quarter pricing or limited instructor availability' },
      negotiation: { next_best_action: 'Prepare 3 alternative pricing scenarios (same value, different structure)', closing_strategy: 'Anchor on total value not price; offer payment flexibility if needed' },
    };
    const fallback = stageAdvice[deal.stage] || { next_best_action: deal.next_action || 'Review deal status', closing_strategy: 'Focus on customer pain points and value demonstration' };

    return Response.json({
      next_best_action: (coaching.next_best_action as string) || String(fallback.next_best_action),
      risk_factors: (coaching.risk_factors as string[]) || ['Deal stagnation risk', 'Budget approval delays', 'Competitor engagement'],
      objection_handling: (coaching.objection_handling as Record<string,unknown>) || { likely_objection: 'Price concern', response_script: 'Our clients average 3:1 ROI within 12 months — let me show you the calculation for your team size.' },
      competitive_positioning: (coaching.competitive_positioning as string) || 'Lead with live instructor advantage — 3x higher completion rates vs app-only solutions',
      closing_strategy: (coaching.closing_strategy as string) || String(fallback.closing_strategy),
      email_template: (coaching.email_template as string) || `Hi ${deal.contact?.split(' ')[0]},\n\nThank you for considering our corporate wellness program. Based on our conversation, I believe we can help ${deal.company} significantly reduce burnout and improve team productivity.\n\nI'd love to show you the specific ROI calculation for your team. Are you available for a 20-minute call this week?\n\nBest regards`,
      probability_assessment: (coaching.probability_assessment as number) || deal.probability,
      ai_generated: !!coaching.next_best_action,
    });
  } finally { client.release(); }
}
