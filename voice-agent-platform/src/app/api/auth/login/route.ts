import { NextRequest, NextResponse } from 'next/server';
import { createSession, findAdminUserByEmail, SESSION_COOKIE, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const email = (body.email ?? '').trim();
  const password = body.password ?? '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required.' }, { status: 400 });
  }

  const user = await findAdminUserByEmail(email);
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
  return response;
}
