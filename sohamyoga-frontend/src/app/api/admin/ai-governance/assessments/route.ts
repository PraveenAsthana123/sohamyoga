import { NextRequest, NextResponse } from 'next/server';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getAiGovernanceDb } from '@/domain/ai-governance/db';
import { aiGovernanceAssessment } from '@/domain/ai-governance/schema';
import { createAssessmentSchema } from '@/domain/ai-governance/validation';
import { desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/ai-governance/assessments — real assessment history, most recent first
export async function GET(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const db = getAiGovernanceDb();
  const rows = await db.select().from(aiGovernanceAssessment).orderBy(desc(aiGovernanceAssessment.createdAt)).limit(100);
  return NextResponse.json({ assessments: rows });
}

// POST /api/admin/ai-governance/assessments — record a real assessment
// against one of the 35 framework categories. Zod-validated (real
// validation library adoption, TalentsHill-inspired -- see
// docs/evidence/TALENTSHILL_COMPARISON.md).
export async function POST(req: NextRequest) {
  const { denied } = await getAdminPrincipal(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getAiGovernanceDb();
  const [row] = await db.insert(aiGovernanceAssessment).values({
    frameworkId: parsed.data.frameworkId,
    subject: parsed.data.subject,
    score: parsed.data.score ?? null,
    assessorName: parsed.data.assessorName ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  return NextResponse.json({ assessment: row }, { status: 201 });
}
