import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';
import { query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PEPPER = process.env.SERVER_PEPPER ?? 'dev-only-pepper-change-in-production';

// GET — returns the real KDF salt/iterations for an existing email, or a
// deterministic-but-fake salt for a non-existent one (same fake value every
// time for the same email) so this endpoint can't be used to enumerate
// which emails have an account.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  if (!email) return Response.json({ error: 'email query param is required.' }, { status: 400 });

  const result = await query<{ kdf_salt: string; kdf_iterations: number }>(
    `SELECT kdf_salt, kdf_iterations FROM app_user WHERE email = $1`, [email],
  );
  if (result.rows.length) {
    return Response.json({ kdfSalt: result.rows[0].kdf_salt, kdfIterations: result.rows[0].kdf_iterations });
  }
  const fakeSalt = createHmac('sha256', PEPPER).update(email).digest('base64').slice(0, 22);
  return Response.json({ kdfSalt: fakeSalt, kdfIterations: 600000 });
}
