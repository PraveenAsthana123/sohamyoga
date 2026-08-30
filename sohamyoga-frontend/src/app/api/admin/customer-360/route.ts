import { NextRequest } from 'next/server';
import { databaseConfigured } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';
import { getPrimaryTenantId } from '@/domain/ingestion/Connector';
import { getCustomer360 } from '@/domain/customer/Customer360';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/customer-360?email=<email> — Module 22 (CRM, Customer 360,
// CDP & Master Customer Data Management). A real, live read-aggregation
// across customer, student, campaign_lead, journey_touchpoint, booking,
// service_review, event_registration, survey_response, and form_submission
// (matched via the form's own declared email field — see Customer360.ts).
// No denormalized copy is written anywhere; every call re-queries the
// real source tables so the view can never go stale.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const email = req.nextUrl.searchParams.get('email')?.trim();
  if (!email) return Response.json({ error: 'email query parameter is required.' }, { status: 400 });

  const tenantId = await getPrimaryTenantId();
  const result = await getCustomer360(tenantId, email);
  return Response.json(result);
}
