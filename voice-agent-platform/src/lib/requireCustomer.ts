import { NextRequest, NextResponse } from 'next/server';
import { resolveCustomerSession, CustomerSessionPrincipal, CUSTOMER_SESSION_COOKIE } from '@/domain/customer/customerAuth';

/**
 * Gate for every business-customer API route. Mirrors requireAdmin.ts
 * exactly but resolves against business_customer_session/business_customer
 * -- a completely separate session system from admin auth. A business
 * customer principal NEVER grants access to admin routes, Vapi config, or
 * another business's data.
 */
export async function requireCustomer(
  req: NextRequest,
): Promise<{ principal: CustomerSessionPrincipal; denied?: undefined } | { principal?: undefined; denied: NextResponse }> {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  const principal = await resolveCustomerSession(token);
  if (!principal) {
    return { denied: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  return { principal };
}
