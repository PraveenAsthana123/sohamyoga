import { NextRequest } from 'next/server';
import argon2 from 'argon2';
import { query } from '@/lib/postgres';
import { createSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SignupBody {
  email?: string;
  kdfSalt?: string;
  kdfIterations?: number;
  authHash?: string;              // client-derived, never the master password/key
  encryptedVaultKey?: string;
  encryptedVaultKeyIv?: string;
}

// POST — the server receives ONLY: email, a random salt, an iteration count,
// a one-way auth hash derived from the master key (not the key itself), and
// the vault key already encrypted client-side. It re-hashes authHash with
// Argon2id before storing -- a raw DB leak alone does not hand out a usable
// login credential, and nothing here can ever decrypt a vault item.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as SignupBody | null;
  if (!body?.email || !body.kdfSalt || !body.authHash || !body.encryptedVaultKey || !body.encryptedVaultKeyIv) {
    return Response.json({ error: 'email, kdfSalt, authHash, encryptedVaultKey, and encryptedVaultKeyIv are required.' }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Invalid email.' }, { status: 400 });

  const serverAuthHash = await argon2.hash(body.authHash, { type: argon2.argon2id });

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO app_user (email, kdf_salt, kdf_iterations, auth_hash, encrypted_vault_key, encrypted_vault_key_iv)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [email, body.kdfSalt, body.kdfIterations ?? 600000, serverAuthHash, body.encryptedVaultKey, body.encryptedVaultKeyIv],
    );
    const userId = result.rows[0].id;
    const { token, expiresAt } = await createSession(userId);

    const res = Response.json({ ok: true, userId });
    res.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Expires=${expiresAt.toUTCString()}`);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('duplicate key') ? 409 : 502;
    return Response.json({ error: status === 409 ? 'An account with this email already exists.' : message }, { status });
  }
}
