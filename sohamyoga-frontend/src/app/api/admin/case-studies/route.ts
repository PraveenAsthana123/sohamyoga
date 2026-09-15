import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { createCaseStudy, listCaseStudies } from '@/domain/casestudy/CaseStudy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const tenantId = await getPrimaryTenantId();
  return Response.json({ caseStudies: await listCaseStudies(tenantId) });
}

export async function POST(req: NextRequest) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const body = await req.json().catch(() => null) as { title?: string; narrative?: string; evidenceIds?: string[] } | null;
  if (!body?.title || !body.narrative) return Response.json({ error: 'title and narrative are required.' }, { status: 400 });
  const tenantId = await getPrimaryTenantId();
  const caseStudy = await createCaseStudy(tenantId, body.title, body.narrative, body.evidenceIds ?? [], principal?.email ?? 'admin');
  return Response.json({ caseStudy }, { status: 201 });
}
