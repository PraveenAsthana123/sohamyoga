import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Revokes (rejects) an active or pending QR challenge session.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { principal, denied } = await getAdminPrincipal(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const { id } = params;
  if (!id) return Response.json({ error: 'id is required' }, { status: 400 });

  try {
    const result = await query(
      `UPDATE qr_login_challenge
       SET status = 'rejected'
       WHERE id = $1 AND status IN ('pending', 'approved')
       RETURNING id`,
      [id],
    );
    if ((result.rowCount ?? 0) === 0) {
      return Response.json({ error: 'Session not found or already in a terminal state.' }, { status: 404 });
    }
    console.log(`[qr-kiosk] Session ${id} revoked by ${principal?.email ?? 'admin'}`);
    return Response.json({ ok: true, id });
  } catch {
    return Response.json({ error: 'Failed to revoke session.' }, { status: 500 });
  }
}
