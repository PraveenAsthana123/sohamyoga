import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { computeImportanceSatisfactionMatrix } from '@/domain/marketresearch/ImportanceSatisfactionMatrix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const surveyId = req.nextUrl.searchParams.get('surveyId');
  if (!surveyId) return Response.json({ error: 'A surveyId query param is required.' }, { status: 400 });

  const matrix = await computeImportanceSatisfactionMatrix(surveyId);
  return Response.json({ matrix });
}
