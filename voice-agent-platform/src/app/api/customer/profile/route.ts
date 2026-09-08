import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/requireCustomer';
import { getBusinessCustomer, updateBusinessCustomerProfile } from '@/domain/customer/repository';
import { ClinicServiceType } from '@/domain/script/CallScript';

export async function GET(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;
  const customer = await getBusinessCustomer(auth.principal.id);
  if (!customer) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(customer.toJSON());
}

// PATCH /api/customer/profile -- business_name/service_type/services_
// description/pricing_info/business_hours/holidays_closures. This is the
// real business context that grounds THEIR call scripts and Vapi assistant
// content -- never fabricated, always sourced from what the business
// itself entered here.
export async function PATCH(req: NextRequest) {
  const auth = await requireCustomer(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  try {
    const updated = await updateBusinessCustomerProfile(auth.principal.id, {
      businessName: typeof body.businessName === 'string' ? body.businessName : undefined,
      serviceType: typeof body.serviceType === 'string' ? (body.serviceType as ClinicServiceType) : undefined,
      servicesDescription: typeof body.servicesDescription === 'string' ? body.servicesDescription : undefined,
      pricingInfo: typeof body.pricingInfo === 'string' ? body.pricingInfo : undefined,
      businessHours: typeof body.businessHours === 'string' ? body.businessHours : undefined,
      holidaysClosures: typeof body.holidaysClosures === 'string' ? body.holidaysClosures : undefined,
      welcomeNote: typeof body.welcomeNote === 'string' ? body.welcomeNote : undefined,
      thankYouNote: typeof body.thankYouNote === 'string' ? body.thankYouNote : undefined,
      paymentNote: typeof body.paymentNote === 'string' ? body.paymentNote : undefined,
    });
    return NextResponse.json(updated.toJSON());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update profile.' }, { status: 400 });
  }
}
