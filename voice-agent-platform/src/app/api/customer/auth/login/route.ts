import { NextRequest, NextResponse } from 'next/server';
import { createCustomerSession, findBusinessCustomerByEmail, verifyPassword, CUSTOMER_SESSION_COOKIE } from '@/domain/customer/customerAuth';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!email || !password) return NextResponse.json({ error: 'email and password are required.' }, { status: 400 });

  const customer = await findBusinessCustomerByEmail(email);
  if (!customer || !customer.is_active || !verifyPassword(password, customer.password_hash)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const { token, expiresAt } = await createCustomerSession(customer.id);
  const response = NextResponse.json({ id: customer.id, email: customer.email, businessName: customer.business_name });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: expiresAt, path: '/',
  });
  return response;
}
