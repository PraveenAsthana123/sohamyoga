import { NextRequest } from 'next/server';
import { databaseConfigured, query } from '@/lib/postgres';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!databaseConfigured()) return Response.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const rows = await query<{ id: string; name: string; slug: string; parent_slug: string | null }>(
    `SELECT c.id, c.name, c.slug, p.slug AS parent_slug
     FROM category c LEFT JOIN category p ON p.id = c.parent_id
     WHERE c.is_active = true ORDER BY c.sort_order`,
  );

  return Response.json({
    categories: rows.rows.map(c => ({ id: c.id, name: c.name, slug: c.slug, parentSlug: c.parent_slug ?? undefined })),
  });
}
