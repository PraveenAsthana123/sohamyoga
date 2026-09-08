import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { validateMethodology } from '@/domain/marketresearch/MethodologyValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = await params;
  try {
    const result = await validateMethodology(id);
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Research project not found.' }, { status: 404 });
  }
}
