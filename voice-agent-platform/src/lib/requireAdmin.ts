import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, SESSION_COOKIE, SessionPrincipal } from './auth';

/**
 * Gate for every admin API route. Reads the session cookie, resolves it
 * against the real admin_session/admin_user tables, and returns either the
 * authenticated principal or a 401 Response to return immediately.
 *
 * Usage:
 *   const auth = await requireAdmin(req);
 *   if (auth.denied) return auth.denied;
 *   // auth.principal is now available
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ principal: SessionPrincipal; denied?: undefined } | { principal?: undefined; denied: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const principal = await resolveSession(token);
  if (!principal) {
    return { denied: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  return { principal };
}
