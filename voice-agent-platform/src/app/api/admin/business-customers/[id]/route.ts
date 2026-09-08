import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { getBusinessCustomer, updateBusinessCustomerProfile, listContactsForCustomer, listCallLogForCustomer } from '@/domain/customer/repository';
import { ClinicServiceType } from '@/domain/script/CallScript';

// GET /api/admin/business-customers/:id -- full admin view of one business:
// profile + their contacts + their call history, everything the business
// would see in their own self-service portal, viewable/editable by staff.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  const customer = await getBusinessCustomer(params.id);
  if (!customer) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const [contacts, calls] = await Promise.all([
    listContactsForCustomer(params.id),
    listCallLogForCustomer(params.id),
  ]);
  return NextResponse.json({ profile: customer.toJSON(), contacts, calls });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  try {
    const updated = await updateBusinessCustomerProfile(params.id, {
      businessName: typeof body.businessName === 'string' ? body.businessName : undefined,
      serviceType: typeof body.serviceType === 'string' ? (body.serviceType as ClinicServiceType) : undefined,
      servicesDescription: typeof body.servicesDescription === 'string' ? body.servicesDescription : undefined,
      pricingInfo: typeof body.pricingInfo === 'string' ? body.pricingInfo : undefined,
      businessHours: typeof body.businessHours === 'string' ? body.businessHours : undefined,
      holidaysClosures: typeof body.holidaysClosures === 'string' ? body.holidaysClosures : undefined,
    });
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update profile.' }, { status: 400 });
  }
}
