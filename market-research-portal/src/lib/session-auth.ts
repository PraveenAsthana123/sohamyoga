// Single-admin session auth — env-configured admin email + password,
// session cookie backed by admin_session (only the SHA-256 hash of the
// token is stored). This is an internal owner tool, not multi-tenant —
// simplest secure option matching actual scale, per the plan.

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { query } from './postgres';

export const SESSION_COOKIE_NAME = 'mrp_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface LoginResult {
  ok: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    return { ok: false, error: 'Admin credentials are not configured on the server.' };
  }
  const emailOk = safeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase());
  const passOk = safeEqual(password, adminPassword);
  if (!emailOk || !passOk) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO admin_session (token_hash, email, expires_at) VALUES ($1, $2, $3)`,
    [hashToken(token), adminEmail, expiresAt],
  );
  return { ok: true, token, expiresAt };
}

export async function logout(token: string): Promise<void> {
  await query(`DELETE FROM admin_session WHERE token_hash = $1`, [hashToken(token)]);
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const result = await query<{ id: string }>(
    `SELECT id FROM admin_session WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(token)],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Route-handler guard — returns a 401 Response if not authenticated, else null. */
export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSession(token);
  if (!valid) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }
  return null;
}
