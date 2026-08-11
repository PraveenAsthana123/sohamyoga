import { NextRequest } from 'next/server';
import { SERVER_API_URL } from './server-api';

export type CustomerPrincipal = { id: string; email?: string; name?: string; roles: string[] };

export async function getCustomerPrincipal(req: NextRequest): Promise<{ principal?: CustomerPrincipal; denied?: Response }> {
  try {
    const response = await fetch(`${SERVER_API_URL}/api/customer/auth/me`, {
      headers: { cookie: req.headers.get('cookie') || '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { denied: Response.json({ error: 'Authentication required.' }, { status: 401 }) };
    const user = await response.json() as CustomerPrincipal;
    return { principal: user };
  } catch {
    return { denied: Response.json({ error: 'Authentication service is unavailable.' }, { status: 503 }) };
  }
}

export async function requireCustomer(req: NextRequest): Promise<Response | null> {
  const result = await getCustomerPrincipal(req);
  return result.denied || null;
}
