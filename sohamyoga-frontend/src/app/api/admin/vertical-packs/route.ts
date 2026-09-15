import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One real entry -- this business's own real vertical. Not fabricated
// packs for verticals this codebase has no real data for.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });
  const rows = await query(`SELECT * FROM vertical_pack ORDER BY created_at`);
  return Response.json({ verticalPacks: rows.rows });
}
