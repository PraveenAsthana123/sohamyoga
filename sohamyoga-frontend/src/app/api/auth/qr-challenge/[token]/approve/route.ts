import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireCustomer, getCustomerPrincipal } from '@/lib/customer-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real approval -- only an authenticated customer (on their phone, having
// scanned the QR) can approve. Honest scope: this records real approval,
// but does NOT mint a session for the browser that showed the QR code --
// this app has no server-to-server capability to issue a new session on
// the external auth backend (getCustomerPrincipal only forwards this
// request's own cookie; there is no "impersonate another browser" endpoint
// on the .NET identity service). The kiosk UI discloses this rather than
// faking a sign-in.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const denied = await requireCustomer(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { token } = await params;
  const { principal } = await getCustomerPrincipal(req);

  const challenge = await query<{ status: string; expires_at: string }>(
    `SELECT status, expires_at FROM qr_login_challenge WHERE challenge_token = $1`, [token],
  );
  if (!challenge.rowCount) return Response.json({ error: 'Challenge not found.' }, { status: 404 });
  if (new Date(challenge.rows[0].expires_at) < new Date()) {
    return Response.json({ error: 'This QR code has expired.' }, { status: 410 });
  }
  if (challenge.rows[0].status !== 'pending') {
    return Response.json({ error: `This QR code is already ${challenge.rows[0].status}.` }, { status: 409 });
  }

  await query(
    `UPDATE qr_login_challenge SET status = 'approved', approved_by_session_id = $2, used_at = now() WHERE challenge_token = $1`,
    [token, principal!.id],
  );
  return Response.json({ ok: true });
}
