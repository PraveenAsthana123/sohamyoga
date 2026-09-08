import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public status poll -- the browser showing the QR code isn't authenticated
// yet, so this intentionally has no auth check (matches how the real
// v_active_qr_challenges view scopes by status/expiry, not by session).
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { token } = await params;
  await query(
    `UPDATE qr_login_challenge SET status = 'expired' WHERE challenge_token = $1 AND status = 'pending' AND expires_at < now()`,
    [token],
  );
  const row = await query<{ status: string; expires_at: string }>(
    `SELECT status, expires_at FROM qr_login_challenge WHERE challenge_token = $1`, [token],
  );
  if (!row.rowCount) return Response.json({ error: 'Challenge not found.' }, { status: 404 });

  return Response.json({ status: row.rows[0].status, expiresAt: row.rows[0].expires_at });
}
