import { NextRequest, NextResponse } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getAiGovernanceDb } from '@/domain/ai-governance/db';
import { aiGovernanceFramework, aiGovernanceAssessment } from '@/domain/ai-governance/schema';
import { asc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/ai-governance — real 35-category framework list, each with
// its real assessment count and average score (honest 0/null if none exist
// yet for a category, never fabricated).
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const db = getAiGovernanceDb();
  const frameworks = await db.select().from(aiGovernanceFramework).orderBy(asc(aiGovernanceFramework.sortOrder));
  const assessments = await db.select().from(aiGovernanceAssessment);

  const byFramework = new Map<string, typeof assessments>();
  for (const a of assessments) {
    const list = byFramework.get(a.frameworkId) ?? [];
    list.push(a);
    byFramework.set(a.frameworkId, list);
  }

  const result = frameworks.map((f) => {
    const list = byFramework.get(f.id) ?? [];
    const scored = list.filter((a) => a.score !== null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length)
      : null;
    return {
      id: f.id,
      categoryKey: f.categoryKey,
      categoryName: f.categoryName,
      description: f.description,
      totalItems: f.totalItems,
      assessmentCount: list.length,
      avgScore,
    };
  });

  return NextResponse.json({ frameworks: result });
}
