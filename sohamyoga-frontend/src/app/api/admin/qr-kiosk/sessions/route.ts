import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns recent QR challenge sessions for the admin kiosk monitoring page.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await query(
      `SELECT id, challenge_token, browser_session_id, device_hint, status,
              created_at, expires_at, used_at, approved_by_session_id
       FROM qr_login_challenge
       ORDER BY created_at DESC
       LIMIT 200`,
    );
    return Response.json({ sessions: rows.rows });
  } catch {
    // Table may not exist yet — return empty, honest state.
    return Response.json({ sessions: [] });
  }
}
