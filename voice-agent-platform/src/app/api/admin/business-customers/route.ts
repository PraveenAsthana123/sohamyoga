import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';
import { listBusinessCustomers, registerBusinessCustomer } from '@/domain/customer/repository';
import { findBusinessCustomerByEmail } from '@/domain/customer/customerAuth';
import { ClinicServiceType, CLINIC_SERVICE_TYPES } from '@/domain/script/CallScript';

const VALID_SERVICE_TYPES: ClinicServiceType[] = CLINIC_SERVICE_TYPES;

// GET/POST /api/admin/business-customers -- admin-side equivalent of
// customer self-registration, for a business that does not want to handle
// its own profile/contacts/scripts. Admin creates and manages the account
// on their behalf; the business can still log in and self-serve later if
// they choose to.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;
  const customers = await listBusinessCustomers();
  return NextResponse.json(customers.map(c => c.toJSON()));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.denied) return auth.denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
  const serviceType = body.serviceType as ClinicServiceType;
  if (!email || !password || !businessName) {
    return NextResponse.json({ error: 'email, password, and businessName are required.' }, { status: 400 });
  }
  if (!VALID_SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json({ error: `serviceType must be one of: ${VALID_SERVICE_TYPES.join(', ')}` }, { status: 400 });
  }

  const existing = await findBusinessCustomerByEmail(email);
  if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

  try {
    const customer = await registerBusinessCustomer({
      email, password, businessName, serviceType,
      servicesDescription: typeof body.servicesDescription === 'string' ? body.servicesDescription : undefined,
      pricingInfo: typeof body.pricingInfo === 'string' ? body.pricingInfo : undefined,
      businessHours: typeof body.businessHours === 'string' ? body.businessHours : undefined,
      holidaysClosures: typeof body.holidaysClosures === 'string' ? body.holidaysClosures : undefined,
    });
    return NextResponse.json(customer.toJSON(), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create business customer.' }, { status: 400 });
  }
}
