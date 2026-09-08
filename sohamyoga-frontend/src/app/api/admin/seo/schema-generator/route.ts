import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { generateSchemaForTenant } from '@/domain/seo/SchemaGenerator';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real schema.org JSON-LD generator -- built from marketing_business_profile
// + branch (both real tables), never fabricated placeholder data.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (!databaseConfigured()) {
    return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  }

  try {
    const tenantId = await getPrimaryTenantId();
    const result = await generateSchemaForTenant(tenantId);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not generate schema.' }, { status: 400 });
  }
}
