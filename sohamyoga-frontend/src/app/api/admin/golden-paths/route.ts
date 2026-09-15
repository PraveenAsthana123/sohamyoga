import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real end-to-end flows actually built and live-verified this session,
// each pointing to the real docs/testing/*.md evidence log that proves it.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const rows = await query(`SELECT * FROM golden_path ORDER BY path_key`);
  return Response.json({ goldenPaths: rows.rows });
}
