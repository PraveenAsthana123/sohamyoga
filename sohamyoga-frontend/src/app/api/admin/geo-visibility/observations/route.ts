import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Returns individual geo_mention_observation rows for the admin GEO/AEO page.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await query(
      `SELECT id, platform, query_text, was_mentioned, excerpt, observed_at, created_by, created_at
       FROM geo_mention_observation
       ORDER BY created_at DESC
       LIMIT 200`,
    );
    return Response.json({ observations: rows.rows });
  } catch {
    return Response.json({ observations: [] });
  }
}
