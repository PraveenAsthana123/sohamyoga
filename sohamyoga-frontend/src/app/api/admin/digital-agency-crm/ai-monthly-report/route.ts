import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { company_name, report_month, impressions, clicks, conversions, spend, roas, seo_keywords_top10, organic_growth, top_campaign } = await req.json();

  const prompt = `Write a monthly digital marketing performance report for client: ${company_name}. Month: ${report_month}. Key metrics: Impressions: ${impressions?.toLocaleString() ?? 'N/A'}, Clicks: ${clicks?.toLocaleString() ?? 'N/A'}, Conversions: ${conversions ?? 'N/A'}, Spend: $${spend ?? 'N/A'}, ROAS: ${roas ?? 'N/A'}x. SEO: ${seo_keywords_top10 ?? 'N/A'} keywords in top 10, organic growth: ${organic_growth ?? 'N/A'}%. Top campaign: ${top_campaign ?? 'N/A'}. Include: executive summary (2-3 sentences), wins this month, areas for optimization, recommendations for next month, and a confident forward-looking close. Client-facing, professional but accessible tone.`;

  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Ollama error');
    const data = await res.json();
    return Response.json({ report: data.response });
  } catch {
    return Response.json({ report: `Monthly Performance Report – ${company_name} (${report_month})\n\nExecutive Summary: This month demonstrated solid performance across your digital marketing channels. The campaigns delivered measurable results with a focus on driving qualified traffic and conversions.\n\nWins This Month:\n• Strong impression volume driving brand awareness\n• ROAS of ${roas ?? 'N/A'}x indicates healthy return on ad spend\n• ${seo_keywords_top10 ?? 'N/A'} keywords achieving top-10 ranking\n\nAreas for Optimization:\n• Review underperforming ad sets and reallocate budget\n• A/B test landing page copy to improve conversion rates\n• Expand keyword coverage for organic growth\n\nRecommendations for Next Month:\n1. Increase budget allocation to highest-ROAS campaigns\n2. Launch retargeting sequences for unconverted traffic\n3. Publish 2 new long-form SEO articles targeting informational intent\n\nLooking ahead, we are well-positioned to continue building on this momentum and exceed targets in the coming month. [Generated offline — Ollama unavailable]`, fallback: true });
  }
}
