import { randomBytes, createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { query } from './postgres';

const SESSION_COOKIE = 'pm_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    `INSERT INTO app_session (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  return { token, expiresAt };
}

export async function getUserIdFromSession(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await query<{ user_id: string }>(
    `SELECT user_id FROM app_session WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function destroySession(req: NextRequest): Promise<void> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await query(`DELETE FROM app_session WHERE token_hash = $1`, [hashToken(token)]);
}

export { SESSION_COOKIE, SESSION_TTL_MS };
