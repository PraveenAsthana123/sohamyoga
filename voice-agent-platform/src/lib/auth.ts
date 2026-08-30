import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { query } from './db';

export const SESSION_COOKIE = 'vap_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Hashes a plaintext password with scrypt (Node built-in, no extra dependency).
 * Format: scrypt$<saltHex>$<hashHex> so verification is self-describing. */
export function hashPassword(password: string): string {
  if (!password || password.length < 8) throw new Error('password must be at least 8 characters');
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_active: boolean;
}

export async function findAdminUserByEmail(email: string): Promise<AdminUserRow | null> {
  const { rows } = await query<AdminUserRow>(
    'SELECT id, email, password_hash, display_name, is_active FROM admin_user WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return rows[0] ?? null;
}

export async function createSession(adminUserId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query('INSERT INTO admin_session (token, admin_user_id, expires_at) VALUES ($1, $2, $3)', [
    token,
    adminUserId,
    expiresAt,
  ]);
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM admin_session WHERE token = $1', [token]);
}

export interface SessionPrincipal {
  id: string;
  email: string;
  displayName: string;
}

export async function resolveSession(token: string | undefined): Promise<SessionPrincipal | null> {
  if (!token) return null;
  const { rows } = await query<{ id: string; email: string; display_name: string }>(
    `SELECT u.id, u.email, u.display_name
       FROM admin_session s
       JOIN admin_user u ON u.id = s.admin_user_id
      WHERE s.token = $1 AND s.expires_at > now() AND u.is_active = TRUE`,
    [token]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name };
}
