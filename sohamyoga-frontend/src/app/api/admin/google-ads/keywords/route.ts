import { NextRequest } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO_SUGGESTIONS = [
  { keyword: 'yoga classes near me', matchType: 'phrase', avgCpc: 1.20, competition: 'HIGH', qualityScore: 8 },
  { keyword: 'online yoga studio', matchType: 'broad', avgCpc: 0.95, competition: 'MEDIUM', qualityScore: 7 },
  { keyword: 'beginner yoga', matchType: 'phrase', avgCpc: 0.80, competition: 'MEDIUM', qualityScore: 7 },
  { keyword: 'hot yoga classes', matchType: 'exact', avgCpc: 1.50, competition: 'HIGH', qualityScore: 9 },
  { keyword: 'prenatal yoga', matchType: 'exact', avgCpc: 1.10, competition: 'LOW', qualityScore: 8 },
  { keyword: 'yoga for seniors', matchType: 'broad', avgCpc: 0.65, competition: 'LOW', qualityScore: 6 },
  { keyword: 'vinyasa flow yoga', matchType: 'phrase', avgCpc: 0.90, competition: 'MEDIUM', qualityScore: 7 },
  { keyword: 'yoga retreat weekend', matchType: 'broad', avgCpc: 2.10, competition: 'LOW', qualityScore: 6 },
];

export async function GET(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  void principal;

  const { searchParams } = new URL(req.url);
  const seed = searchParams.get('seed') ?? 'yoga';
  void seed;

  return Response.json({
    demo: !process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    message: !process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      ? 'Demo keyword suggestions — connect Google Ads for real Keyword Planner data.'
      : 'Keyword planner API not yet integrated — showing representative data.',
    keywords: DEMO_SUGGESTIONS,
  });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  void principal;

  const body = await req.json();
  const { seed } = body;
  if (!seed) return Response.json({ error: 'seed keyword required' }, { status: 400 });

  // In a real integration this would call Google Keyword Planner API.
  return Response.json({
    demo: true,
    message: 'Google Ads Keyword Planner API not connected — showing demo suggestions.',
    keywords: DEMO_SUGGESTIONS.slice(0, 5),
  });
}
