import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { getAdminPrincipal } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Real 15-pose asana library, for pose pickers in plan/assessment authoring.
export async function GET(req: NextRequest) {
  const denied = (await getAdminPrincipal(req)).denied;
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const asanas = await query(
    `SELECT id, sanskrit_name, english_name, difficulty_level FROM asana WHERE is_active = true ORDER BY english_name`,
  );
  return Response.json({ asanas: asanas.rows });
}
