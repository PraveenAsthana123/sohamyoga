import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured } from '@/lib/postgres';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { listLocations, createLocation } from '@/domain/seo/locationRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real CRUD over the `branch` table -- this is the same table Schema
// Generator and the Local SEO checker already read from (and reported as
// empty). This is where those NAP fields actually get entered for real.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const tenantId = await getPrimaryTenantId();
  const locations = await listLocations(tenantId);
  return Response.json({ locations });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const required = ['name', 'type', 'addressLine1', 'city', 'state', 'country', 'postalCode', 'timezone', 'maxCapacity'];
  for (const field of required) {
    if (body?.[field] === undefined || body[field] === '') {
      return Response.json({ error: `${field} is required.` }, { status: 400 });
    }
  }

  try {
    const tenantId = await getPrimaryTenantId();
    const location = await createLocation(tenantId, body);
    return Response.json(location, { status: 201 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not create location.' }, { status: 400 });
  }
}
