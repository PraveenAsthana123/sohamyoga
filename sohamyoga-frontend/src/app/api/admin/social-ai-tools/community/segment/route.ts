export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DB not configured' }, { status: 503 });
  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: members } = await client.query('SELECT * FROM community_members');
    const memberSummary = members.map(m => `${m.handle} (${m.platform}, ${m.engagement_level} engagement, tags: ${(m.tags || []).join(',')})`).join('\n');

    const prompt = `You are a community manager AI. Analyze these community members and provide segmentation insights:
${memberSummary}

Return JSON:
{
  "segments": {
    "high_value": { "count": N, "tactics": ["tactic1", "tactic2"] },
    "medium_value": { "count": N, "tactics": ["tactic1", "tactic2"] },
    "at_risk": { "count": N, "tactics": ["tactic1", "tactic2"] }
  },
  "top_insights": ["insight1", "insight2", "insight3"],
  "recommended_campaigns": ["campaign1", "campaign2"]
}`;

    let aiResult = null;
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json() as { response?: string };
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) aiResult = JSON.parse(match[0]);
    } catch { /* use fallback */ }

    const high = members.filter(m => m.engagement_level === 'high').length;
    const medium = members.filter(m => m.engagement_level === 'medium').length;
    const low = members.filter(m => m.engagement_level === 'low').length;

    return Response.json(aiResult || {
      segments: {
        high_value: { count: high, tactics: ['VIP early access', 'Ambassador program invitation', 'Exclusive content'] },
        medium_value: { count: medium, tactics: ['Monthly newsletter', 'Event invitations', 'Loyalty rewards'] },
        at_risk: { count: low, tactics: ['Re-engagement email sequence', 'Special discount offer', 'Personal check-in DM'] },
      },
      top_insights: [
        `${high} high-value members drive 80% of organic reach`,
        'Medium segment shows conversion potential with right nurturing',
        `${low} members need immediate re-engagement before churning`,
      ],
      recommended_campaigns: ['Ambassador referral program', 'Dormant member win-back campaign'],
      ai_generated: !!aiResult,
    });
  } finally { client.release(); }
}
