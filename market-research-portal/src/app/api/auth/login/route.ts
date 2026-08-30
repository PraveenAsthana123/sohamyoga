import { NextRequest, NextResponse } from 'next/server';
import { login, SESSION_COOKIE_NAME } from '../../../../lib/session-auth';

export async function POST(req: NextRequest) {
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
