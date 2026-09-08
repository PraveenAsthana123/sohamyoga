import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getSamplingStatus, linkProjectSurvey } from '@/domain/marketresearch/SamplingManagement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  try {
    const status = await getSamplingStatus(id);
    return Response.json(status);
  } catch {
    return Response.json({ error: 'Research project not found.' }, { status: 404 });
  }
}

interface LinkBody { surveyId?: string | null; targetSampleSize?: number | null }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as LinkBody | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  if (body.targetSampleSize != null && (!Number.isInteger(body.targetSampleSize) || body.targetSampleSize <= 0)) {
    return Response.json({ error: 'targetSampleSize must be a positive integer.' }, { status: 400 });
  }

  await linkProjectSurvey(id, body.surveyId ?? null, body.targetSampleSize ?? null);
  const status = await getSamplingStatus(id);
  return Response.json(status);
}
