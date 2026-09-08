import { NextRequest, NextResponse } from 'next/server';
import { registerBusinessCustomer } from '@/domain/customer/repository';
import { createCustomerSession, findBusinessCustomerByEmail, CUSTOMER_SESSION_COOKIE } from '@/domain/customer/customerAuth';
import { ClinicServiceType, CLINIC_SERVICE_TYPES } from '@/domain/script/CallScript';

const VALID_SERVICE_TYPES: ClinicServiceType[] = CLINIC_SERVICE_TYPES;

// POST /api/customer/auth/register -- self-service business signup. Real
// scrypt-hashed password (same primitive as admin auth), completely
// separate session system -- a registered business customer never gets
// admin access.
export async function POST(req: NextRequest) {
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
    const { token, expiresAt } = await createCustomerSession(customer.id);
    const response = NextResponse.json(customer.toJSON(), { status: 201 });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/',
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not register.' }, { status: 400 });
  }
}
