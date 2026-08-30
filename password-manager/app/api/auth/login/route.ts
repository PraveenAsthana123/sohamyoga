import { NextRequest } from 'next/server';
import argon2 from 'argon2';
import { query } from '@/lib/postgres';
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface LoginBody { email?: string; authHash?: string }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as LoginBody | null;
  if (!body?.email || !body.authHash) return Response.json({ error: 'email and authHash are required.' }, { status: 400 });
  const email = body.email.trim().toLowerCase();

  const result = await query<{ id: string; auth_hash: string; encrypted_vault_key: string; encrypted_vault_key_iv: string }>(
    `SELECT id, auth_hash, encrypted_vault_key, encrypted_vault_key_iv FROM app_user WHERE email = $1`, [email],
  );
  if (!result.rows.length) {
    // Run a real argon2.verify against a dummy hash so the response timing
    // doesn't reveal whether the email exists.
    await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$dGVzdA', 'x').catch(() => {});
    return Response.json({ error: 'Invalid email or master password.' }, { status: 401 });
  }
  const row = result.rows[0];
  const valid = await argon2.verify(row.auth_hash, body.authHash);
  if (!valid) return Response.json({ error: 'Invalid email or master password.' }, { status: 401 });

  const { token, expiresAt } = await createSession(row.id);
  const res = Response.json({ ok: true, encryptedVaultKey: row.encrypted_vault_key, encryptedVaultKeyIv: row.encrypted_vault_key_iv });
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Expires=${expiresAt.toUTCString()}`);
  return res;
}
