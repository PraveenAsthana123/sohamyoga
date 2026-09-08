import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomerSession, CUSTOMER_SESSION_COOKIE } from '@/domain/customer/customerAuth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (token) await deleteCustomerSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CUSTOMER_SESSION_COOKIE);
  return response;
}
