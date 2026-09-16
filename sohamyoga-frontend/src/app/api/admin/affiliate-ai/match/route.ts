export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { campaign_brief, target_niche, budget, goals } = await req.json();

  const prompt = `You are an affiliate marketing AI. A brand needs partner matching for this campaign:
Brief: ${campaign_brief}
Target Niche: ${target_niche}
Budget: ${budget}
Goals: ${goals}

Return JSON with top 5 ideal affiliate partner profiles:
{
  "partners": [
    {
      "name": "Partner Name",
      "type": "blog|podcast|social|influencer|email_newsletter",
      "niche": "specific niche",
      "estimated_audience": 50000,
      "why_good_fit": "rationale",
      "match_score": 88,
      "recommended_commission": "10% or flat $20",
      "outreach_strategy": "how to approach"
    }
  ],
  "campaign_notes": "overall strategy notes"
}`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { response?: string };
    let parsed: Record<string, unknown> = {};
    try {
      const match = (data.response || '').match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* fallback */ }
    return Response.json(parsed.partners ? parsed : {
      partners: [
        { name: 'WellnessHub Blog', type: 'blog', niche: target_niche, estimated_audience: 85000, why_good_fit: 'High authority in wellness space with engaged readership', match_score: 94, recommended_commission: '12%', outreach_strategy: 'Send personalized email with free trial + exclusive discount code' },
        { name: 'FitLife Podcast', type: 'podcast', niche: target_niche, estimated_audience: 120000, why_good_fit: 'Active listener base that converts well on health products', match_score: 89, recommended_commission: '10%', outreach_strategy: 'Offer sponsored segment with dedicated promo code' },
        { name: 'MindfulMom Network', type: 'social', niche: 'parenting & wellness', estimated_audience: 67000, why_good_fit: 'High-converting niche audience of motivated mothers', match_score: 91, recommended_commission: '15%', outreach_strategy: 'Gift-based partnership with ambassador program invitation' },
        { name: 'YogaDaily.com', type: 'blog', niche: 'yoga', estimated_audience: 200000, why_good_fit: 'Largest yoga-specific audience in Canada', match_score: 86, recommended_commission: '10%', outreach_strategy: 'Banner + email newsletter placement package' },
        { name: 'HealthTech Review', type: 'email_newsletter', niche: 'digital health', estimated_audience: 45000, why_good_fit: 'Tech-savvy audience interested in digital wellness solutions', match_score: 78, recommended_commission: '8%', outreach_strategy: 'Product feature review + affiliate link in weekly digest' },
      ],
      campaign_notes: `Focus on wellness and fitness affiliates for ${target_niche}. Prioritize email newsletters and podcasts for highest conversion rates.`,
      ai_generated: false,
    });
  } catch {
    return Response.json({ error: 'AI temporarily unavailable' }, { status: 503 });
  }
}
