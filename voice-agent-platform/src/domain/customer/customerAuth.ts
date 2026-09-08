import { randomBytes } from 'crypto';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';

export const CUSTOMER_SESSION_COOKIE = 'vap_customer_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours, matches admin session TTL

export interface BusinessCustomerRow {
  id: string;
  email: string;
  password_hash: string;
  business_name: string;
  is_active: boolean;
}

export async function findBusinessCustomerByEmail(email: string): Promise<BusinessCustomerRow | null> {
  const { rows } = await query<BusinessCustomerRow>(
    'SELECT id, email, password_hash, business_name, is_active FROM business_customer WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  return rows[0] ?? null;
}

export { hashPassword, verifyPassword };

export async function createCustomerSession(businessCustomerId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query('INSERT INTO business_customer_session (token, business_customer_id, expires_at) VALUES ($1, $2, $3)', [
    token, businessCustomerId, expiresAt,
  ]);
  return { token, expiresAt };
}

export async function deleteCustomerSession(token: string): Promise<void> {
  await query('DELETE FROM business_customer_session WHERE token = $1', [token]);
}

export interface CustomerSessionPrincipal {
  id: string;
  email: string;
  businessName: string;
}

export async function resolveCustomerSession(token: string | undefined): Promise<CustomerSessionPrincipal | null> {
  if (!token) return null;
  const { rows } = await query<{ id: string; email: string; business_name: string }>(
    `SELECT c.id, c.email, c.business_name
       FROM business_customer_session s
       JOIN business_customer c ON c.id = s.business_customer_id
      WHERE s.token = $1 AND s.expires_at > now() AND c.is_active = TRUE`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, businessName: row.business_name };
}
