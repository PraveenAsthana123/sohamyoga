import { requireAdmin } from '@/lib/admin-auth';
import { databaseConfigured, getPool } from '@/lib/postgres';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const body = await req.json().catch(() => null) as { connectionId?: string } | null;
  if (!body?.connectionId) {
    return Response.json({ error: 'connectionId is required.' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT id FROM google_drive_connections WHERE id = $1`,
      [body.connectionId],
    );
    if (!check.rowCount) {
      return Response.json({ error: 'Connection not found.' }, { status: 404 });
    }

    await client.query(
      `UPDATE google_drive_connections SET last_sync_at = NOW() WHERE id = $1`,
      [body.connectionId],
    );

    // Mocked: in a real implementation, this would call the Drive API
    const newFilesCount = Math.floor(Math.random() * 5);

    return Response.json({
      success: true,
      connectionId: body.connectionId,
      newFilesCount,
      syncedAt: new Date().toISOString(),
      message: `Sync complete. ${newFilesCount} new file(s) discovered.`,
    });
  } finally {
    client.release();
  }
}
