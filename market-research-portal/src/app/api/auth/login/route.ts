import { NextRequest, NextResponse } from 'next/server';
import { login, SESSION_COOKIE_NAME } from '../../../../lib/session-auth';
import { isRateLimited, clientIp } from '../../../../lib/rate-limit';

export async function POST(req: NextRequest) {
  // 2026-09-08 audit fix: this was the one auth-checking endpoint in this
  // portal without a rate limit, unlike leads/capture and intake, which
  // already use this same limiter. 10 attempts/min per IP — generous enough
  // for a real user mistyping a password, tight enough to blunt brute force.
  if (isRateLimited(`auth-login:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many login attempts. Try again shortly.' }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const result = await login(body.email, body.password);
  if (!result.ok || !result.token || !result.expiresAt) {
    return NextResponse.json({ error: result.error ?? 'Login failed.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: result.expiresAt,
  });
  return res;
}
