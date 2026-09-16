import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { company_name, industry, services, budget, objective } = await req.json();

  const prompt = `Create a 90-day digital marketing strategy for: ${company_name} in ${industry}. Services: ${Array.isArray(services) ? services.join(', ') : services}. Budget: $${budget}/month. Goals: ${objective}. Calgary, Alberta market. Include: month-by-month action plan, channel prioritization rationale, KPI targets, content calendar framework, quick wins in first 30 days, and expected outcomes. Agency proposal style.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ strategy: data.response });
  } catch {
    return Response.json({
      strategy: `90-Day Digital Marketing Strategy — ${company_name}\nIndustry: ${industry} | Budget: $${budget}/month | Market: Calgary, AB\n\n**Month 1 — Foundation & Quick Wins**\n• Audit existing channels and establish baseline KPIs\n• Launch Google Ads campaigns targeting high-intent local keywords\n• Optimize Google Business Profile for local search\n• Publish 4 SEO blog posts targeting primary keywords\n• Set up conversion tracking and analytics dashboard\nKPI Targets: 500+ website sessions, 20+ leads, 3.5x ROAS\n\n**Month 2 — Scale & Optimize**\n• Expand winning ad sets; pause underperformers\n• Launch Meta Ads retargeting sequences\n• Activate email marketing welcome sequence\n• Increase content output to 6 posts/month\n• Begin link-building outreach to Calgary-based directories\nKPI Targets: 800+ sessions, 35+ leads, 4.0x ROAS\n\n**Month 3 — Growth & Retention**\n• Launch loyalty or referral program\n• Test new ad creatives and audiences\n• Produce video content for top-of-funnel awareness\n• Monthly performance review and strategy refinement\nKPI Targets: 1,200+ sessions, 55+ leads, 4.5x ROAS\n\n**Channel Prioritization:** SEO (long-term compounding), Google Ads (immediate intent capture), Meta Ads (awareness/retargeting), Email (nurture & retention)\n\n[Generated offline — Ollama unavailable]`,
      fallback: true,
    });
  }
}
