import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { computeRespondentQualityScore } from '@/domain/marketresearch/RespondentQualityScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const formId = req.nextUrl.searchParams.get('formId');
  if (!formId) return Response.json({ error: 'A formId query param is required.' }, { status: 400 });

  const report = await computeRespondentQualityScore(formId);
  return Response.json(report);
}
